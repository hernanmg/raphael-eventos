import type { Prisma } from '@prisma/client';
import type {
  CommissionAdvanceInput,
  EmployeeInput,
  EmployeeSummary,
  EmployeeTimeEntryInput,
  EventStaffAssignmentInput,
  PayrollConfirmInput,
  PayrollEntrySummary,
  PayrollLineInput,
  PayrollPreview,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { computeAggregateFinancials } from '../../lib/financials';
import { generateTemporaryPassword, hashPassword } from '../../lib/password';
import { audit, diffFields, money, snapshot } from '../../lib/audit';

export class NotFoundError extends Error {}
export class EmailInUseError extends Error {}
export class DoorAccessNotAllowedError extends Error {}

function firstOfMonth(dateLike: string): Date {
  const d = new Date(dateLike);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthRange(period: Date): { start: Date; end: Date } {
  return {
    start: period,
    end: new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1)),
  };
}

const EMPLOYEE_INCLUDE = { costCategory: { select: { name: true } } } as const;

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>;

function serializeEmployee(row: EmployeeRow): EmployeeSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    hasDoorAccess: row.userId !== null,
    contractType: row.contractType,
    fixedMonthlyAmount: Number(row.fixedMonthlyAmount),
    variableType: row.variableType,
    variableValue: Number(row.variableValue),
    saleCommissionType: row.saleCommissionType,
    saleCommissionValue: Number(row.saleCommissionValue),
    hourlyRate: Number(row.hourlyRate),
    costCategoryId: row.costCategoryId,
    costCategoryName: row.costCategory?.name ?? null,
    active: row.active,
  };
}

const EMPLOYEE_AUDIT_FIELDS: (keyof EmployeeRow)[] = [
  'fullName',
  'email',
  'contractType',
  'fixedMonthlyAmount',
  'variableType',
  'variableValue',
  'saleCommissionType',
  'saleCommissionValue',
  'hourlyRate',
  'costCategoryId',
  'active',
];

function employeeData(input: EmployeeInput) {
  return { ...input, costCategoryId: input.costCategoryId ?? null };
}

export async function listEmployees(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.employee.findMany({
      where: { tenantId },
      include: EMPLOYEE_INCLUDE,
      orderBy: { fullName: 'asc' },
    });
    return rows.map(serializeEmployee);
  });
}

export async function createEmployee(tenantId: string, input: EmployeeInput) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.employee.create({
      data: { tenantId, ...employeeData(input) },
      include: EMPLOYEE_INCLUDE,
    });
    await audit(tx, tenantId, {
      entityType: 'Employee',
      entityId: row.id,
      action: 'CREATE',
      summary: `Alta del empleado ${row.fullName}`,
      changes: snapshot(row, EMPLOYEE_AUDIT_FIELDS),
    });
    return serializeEmployee(row);
  });
}

export async function updateEmployee(tenantId: string, id: string, input: EmployeeInput) {
  return withTenant(tenantId, async (tx) => {
    const current = await tx.employee.findUnique({ where: { id } });
    if (!current || current.tenantId !== tenantId) throw new NotFoundError();

    // El email del empleado ES su login de puerta: si ya tiene acceso, se
    // mantiene sincronizado en su User.
    if (current.userId && current.email !== input.email) {
      await assertEmailFree(tx, tenantId, input.email, current.userId);
      await tx.user.update({
        where: { id: current.userId },
        data: { email: input.email, fullName: input.fullName },
      });
    }

    const data = employeeData(input);
    const row = await tx.employee.update({ where: { id }, data, include: EMPLOYEE_INCLUDE });
    const changes = diffFields(current as EmployeeRow, data, EMPLOYEE_AUDIT_FIELDS);
    if (changes) {
      const activeChanged = current.active !== input.active;
      await audit(tx, tenantId, {
        entityType: 'Employee',
        entityId: id,
        action: 'UPDATE',
        summary: activeChanged
          ? `${input.active ? 'Reactivación' : 'Baja'} del empleado ${row.fullName}`
          : `Edición del empleado ${row.fullName}`,
        changes,
      });
    }
    return serializeEmployee(row);
  });
}

async function assertEmailFree(
  tx: Prisma.TransactionClient,
  tenantId: string,
  email: string,
  exceptUserId: string | null,
) {
  const other = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
  if (other && other.id !== exceptUserId) throw new EmailInUseError();
}

/**
 * Da acceso de puerta (rol PUERTA, check-in de invitados — Fase 3) a un
 * empleado, o le resetea la contraseña si ya lo tenía. En ambos casos genera
 * una contraseña temporal que se devuelve UNA vez (no se guarda en claro) y
 * deja al usuario con mustChangePassword: el backend no le permite nada más
 * hasta cambiarla. Revocar el acceso = dar de baja al empleado (active).
 */
export async function grantDoorAccess(tenantId: string, employeeId: string) {
  return withTenant(tenantId, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.tenantId !== tenantId) throw new NotFoundError();
    if (!employee.active) {
      throw new DoorAccessNotAllowedError('El empleado está dado de baja');
    }
    if (!employee.email) {
      throw new DoorAccessNotAllowedError('Cargale un email al empleado antes de darle acceso');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    if (employee.userId) {
      await tx.user.update({
        where: { id: employee.userId },
        data: { passwordHash, mustChangePassword: true },
      });
    } else {
      // Nunca reutiliza una cuenta existente (ej. un cliente con ese email):
      // mezclaría el acceso de puerta con el portal de esa persona.
      await assertEmailFree(tx, tenantId, employee.email, null);
      const user = await tx.user.create({
        data: {
          tenantId,
          email: employee.email,
          passwordHash,
          fullName: employee.fullName,
          role: 'PUERTA',
          mustChangePassword: true,
        },
      });
      await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
    }

    // Nunca la contraseña: solo que se dio/reseteó el acceso.
    await audit(tx, tenantId, {
      entityType: 'Employee',
      entityId: employee.id,
      action: 'UPDATE',
      summary: employee.userId
        ? `Nueva contraseña temporal de puerta para ${employee.fullName}`
        : `Acceso de puerta dado a ${employee.fullName}`,
      changes: { accesoPuerta: employee.userId ? 'RESETEADO' : 'OTORGADO', email: employee.email },
    });

    return { email: employee.email, temporaryPassword };
  });
}

function serializeAssignment(row: {
  id: string;
  employeeId: string;
  employee: { fullName: string };
  note: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.fullName,
    note: row.note,
  };
}

export async function listEventStaffAssignments(tenantId: string, eventId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.eventStaffAssignment.findMany({
      where: { tenantId, eventId },
      include: { employee: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serializeAssignment);
  });
}

async function eventTotalValue(tx: Prisma.TransactionClient, tenantId: string, eventId: string) {
  const [beneficiaries, ipcRows] = await Promise.all([
    tx.eventBeneficiary.findMany({
      where: { tenantId, eventId },
      include: { cards: true, payments: true },
    }),
    tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
  ]);
  return computeAggregateFinancials(beneficiaries, ipcRows).totalValue;
}

/** Monto de un componente variable (monto fijo, o % del valor del evento). */
async function variableAmount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  type: string,
  value: Prisma.Decimal,
): Promise<number> {
  if (type === 'COMISION_PCT') {
    const total = await eventTotalValue(tx, tenantId, eventId);
    return Number((total * (Number(value) / 100)).toFixed(2));
  }
  return Number(value);
}

/**
 * Comisión de venta (feedback 2026-10: la comisión es por evento VENDIDO).
 * Se llama en el alta/edición de un evento: borra la comisión
 * auto-generada anterior (salvo que el admin la haya editado a mano) y, si
 * el evento tiene vendedor con comisión y no está cancelado, la genera como
 * gasto del evento. Su liquidación cae en el mes de `soldAt`.
 */
export async function syncSaleCommission(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    include: { soldByEmployee: true },
  });
  if (!event) return;
  await tx.expense.deleteMany({
    where: { tenantId, eventId, autoSource: 'SALE_COMMISSION', manuallyEdited: false },
  });
  const seller = event.soldByEmployee;
  if (!seller || seller.saleCommissionType === 'NINGUNO' || event.status === 'CANCELADO') return;
  const kept = await tx.expense.count({
    where: { tenantId, eventId, autoSource: 'SALE_COMMISSION', employeeId: seller.id },
  });
  if (kept > 0) return; // ya hay una editada a mano para este vendedor
  const amount = await variableAmount(
    tx,
    tenantId,
    eventId,
    seller.saleCommissionType,
    seller.saleCommissionValue,
  );
  await tx.expense.create({
    data: {
      tenantId,
      eventId,
      date: event.soldAt ?? event.createdAt,
      // Sin rubro: se agrupa como "Comisiones de venta" en el costeo, aparte
      // del rubro del empleado (que es para su trabajo: horas, por evento).
      categoryId: null,
      employeeId: seller.id,
      amount,
      detail: `Comisión de venta — ${seller.fullName}`,
      autoSource: 'SALE_COMMISSION',
    },
  });
}

/**
 * Asigna un empleado a un evento (Básica). Si el empleado cobra por evento
 * trabajado, genera solo el gasto correspondiente en el evento (rubro del
 * empleado) en vez de que el admin lo cargue dos veces — decisión ya cerrada
 * en CLAUDE.md "Fase 2 — costeo y personal".
 */
export async function assignStaff(
  tenantId: string,
  eventId: string,
  input: EventStaffAssignmentInput,
) {
  return withTenant(tenantId, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee || employee.tenantId !== tenantId) throw new NotFoundError();

    const assignment = await tx.eventStaffAssignment.create({
      data: { tenantId, eventId, employeeId: input.employeeId, note: input.note ?? null },
      include: { employee: { select: { fullName: true } } },
    });

    if (employee.variableType !== 'NINGUNO') {
      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      const amount = await variableAmount(
        tx,
        tenantId,
        eventId,
        employee.variableType,
        employee.variableValue,
      );
      await tx.expense.create({
        data: {
          tenantId,
          eventId,
          date: event.eventDate ?? new Date(),
          categoryId: employee.costCategoryId,
          employeeId: employee.id,
          amount,
          detail: `${employee.fullName} — evento trabajado`,
          autoSource: 'STAFF_EVENT',
        },
      });
    }

    await audit(tx, tenantId, {
      entityType: 'EventStaffAssignment',
      entityId: assignment.id,
      eventId,
      action: 'CREATE',
      summary: `${employee.fullName} asignado/a al evento`,
      changes: {
        empleado: employee.fullName,
        costoAutoGenerado: employee.variableType !== 'NINGUNO',
      },
    });

    return serializeAssignment(assignment);
  });
}

/**
 * Desasigna un empleado del evento. Borra también el gasto que se
 * auto-generó al asignarlo — salvo que el admin lo haya editado a mano
 * (manuallyEdited), en cuyo caso se deja tal cual.
 */
export async function unassignStaff(tenantId: string, assignmentId: string) {
  return withTenant(tenantId, async (tx) => {
    const assignment = await tx.eventStaffAssignment.findUnique({
      where: { id: assignmentId },
      include: { employee: { select: { fullName: true } } },
    });
    if (!assignment || assignment.tenantId !== tenantId) throw new NotFoundError();

    await tx.expense.deleteMany({
      where: {
        tenantId,
        eventId: assignment.eventId,
        employeeId: assignment.employeeId,
        autoSource: 'STAFF_EVENT',
        manuallyEdited: false,
      },
    });

    await tx.eventStaffAssignment.delete({ where: { id: assignmentId } });
    await audit(tx, tenantId, {
      entityType: 'EventStaffAssignment',
      entityId: assignmentId,
      eventId: assignment.eventId,
      action: 'DELETE',
      summary: `${assignment.employee.fullName} desasignado/a del evento`,
    });
  });
}

// -- Pro: horas, liquidación, comisiones adelantadas -------------------------

function serializeTimeEntry(row: {
  id: string;
  date: Date;
  hours: Prisma.Decimal | null;
  note: string | null;
  eventId: string | null;
  event: { name: string } | null;
}) {
  return {
    id: row.id,
    date: row.date.toISOString(),
    hours: row.hours === null ? null : Number(row.hours),
    note: row.note,
    eventId: row.eventId,
    eventName: row.event?.name ?? null,
  };
}

export async function recordTimeEntry(
  tenantId: string,
  employeeId: string,
  input: EmployeeTimeEntryInput,
) {
  const date = new Date(input.date);
  return withTenant(tenantId, async (tx) => {
    const row = await tx.employeeTimeEntry.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {
        hours: input.hours ?? null,
        note: input.note ?? null,
        eventId: input.eventId ?? null,
      },
      create: {
        tenantId,
        employeeId,
        date,
        hours: input.hours ?? null,
        note: input.note ?? null,
        eventId: input.eventId ?? null,
      },
      include: { event: { select: { name: true } }, employee: { select: { fullName: true } } },
    });
    await audit(tx, tenantId, {
      entityType: 'EmployeeTimeEntry',
      entityId: row.id,
      eventId: row.eventId,
      action: 'UPDATE',
      summary: `Horas de ${row.employee.fullName} el ${date.toISOString().slice(0, 10)}`,
      changes: snapshot(row, ['date', 'hours', 'note', 'eventId']),
    });
    return serializeTimeEntry(row);
  });
}

export async function listTimeEntries(tenantId: string, employeeId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.employeeTimeEntry.findMany({
      where: { tenantId, employeeId },
      include: { event: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    return rows.map(serializeTimeEntry);
  });
}

function serializeCommissionAdvance(row: {
  id: string;
  date: Date;
  amount: Prisma.Decimal;
  eventId: string | null;
  event: { name: string } | null;
  note: string | null;
  reconciledInEntryId: string | null;
}) {
  return {
    id: row.id,
    date: row.date.toISOString(),
    amount: Number(row.amount),
    eventId: row.eventId,
    eventName: row.event?.name ?? null,
    note: row.note,
    reconciledInEntryId: row.reconciledInEntryId,
  };
}

export async function recordCommissionAdvance(
  tenantId: string,
  employeeId: string,
  input: CommissionAdvanceInput,
) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.employeeCommissionAdvance.create({
      data: {
        tenantId,
        employeeId,
        date: new Date(input.date),
        amount: input.amount,
        eventId: input.eventId ?? null,
        note: input.note ?? null,
      },
      include: { event: { select: { name: true } }, employee: { select: { fullName: true } } },
    });
    await audit(tx, tenantId, {
      entityType: 'EmployeeCommissionAdvance',
      entityId: row.id,
      eventId: row.eventId,
      action: 'CREATE',
      summary: `Comisión adelantada a ${row.employee.fullName} por ${money(row.amount)}`,
      changes: snapshot(row, ['date', 'amount', 'eventId', 'note']),
    });
    return serializeCommissionAdvance(row);
  });
}

export async function listCommissionAdvances(tenantId: string, employeeId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.employeeCommissionAdvance.findMany({
      where: { tenantId, employeeId },
      include: { event: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    return rows.map(serializeCommissionAdvance);
  });
}

// -- Liquidación (borrador editable → confirmación) --------------------------

function periodOf(dateLike: string): Date {
  // "YYYY-MM" o cualquier fecha del mes.
  if (/^\d{4}-\d{2}$/.test(dateLike)) {
    const [y, m] = dateLike.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, 1));
  }
  return firstOfMonth(dateLike);
}

const PAYROLL_INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  expense: { select: { amount: true } },
} as const;

type PayrollRow = Prisma.PayrollEntryGetPayload<{ include: typeof PAYROLL_INCLUDE }>;

function serializePayrollEntry(row: PayrollRow): PayrollEntrySummary {
  const fixedComponent = Number(row.fixedComponent);
  const variableComponent = Number(row.variableComponent);
  const advancesDeducted = Number(row.advancesDeducted);
  return {
    id: row.id,
    period: row.period.toISOString(),
    fixedComponent,
    variableComponent,
    advancesDeducted,
    totalPaid: Number((fixedComponent + variableComponent - advancesDeducted).toFixed(2)),
    note: row.note,
    lines: row.lines.map((line) => ({
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: Number(line.quantity),
      unitAmount: Number(line.unitAmount),
      amount: Number(line.amount),
    })),
    expenseAmount: row.expense ? Number(row.expense.amount) : null,
  };
}

/** Datos del mes de un empleado que alimentan el borrador de liquidación. */
async function payrollContext(
  tx: Prisma.TransactionClient,
  tenantId: string,
  employeeId: string,
  period: Date,
) {
  const { start, end } = monthRange(period);
  const existing = await tx.payrollEntry.findUnique({
    where: { employeeId_period: { employeeId, period } },
    include: PAYROLL_INCLUDE,
  });
  const [timeEntries, assignments, sold, advances] = await Promise.all([
    tx.employeeTimeEntry.findMany({
      where: { tenantId, employeeId, date: { gte: start, lt: end } },
    }),
    tx.eventStaffAssignment.findMany({
      where: {
        tenantId,
        employeeId,
        event: { eventDate: { gte: start, lt: end }, status: { not: 'CANCELADO' } },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            eventDate: true,
            expenses: {
              where: { employeeId, autoSource: 'STAFF_EVENT' },
              select: { amount: true },
            },
          },
        },
      },
    }),
    // Vendidos en el mes: por fecha de venta (o de alta, si no se cargó).
    tx.event.findMany({
      where: {
        tenantId,
        soldByEmployeeId: employeeId,
        status: { not: 'CANCELADO' },
        OR: [
          { soldAt: { gte: start, lt: end } },
          { soldAt: null, createdAt: { gte: start, lt: end } },
        ],
      },
      include: {
        expenses: {
          where: { employeeId, autoSource: 'SALE_COMMISSION' },
          select: { amount: true },
        },
      },
      orderBy: { soldAt: 'asc' },
    }),
    // Adelantos sin descontar hasta fin de mes (+ los ya descontados en esta
    // misma liquidación, si se está re-liquidando).
    tx.employeeCommissionAdvance.findMany({
      where: {
        tenantId,
        employeeId,
        date: { lt: end },
        OR: [
          { reconciledInEntryId: null },
          ...(existing ? [{ reconciledInEntryId: existing.id }] : []),
        ],
      },
      orderBy: { date: 'asc' },
    }),
  ]);
  const hours = Number(
    timeEntries.reduce((sum, t) => sum + (t.hours === null ? 0 : Number(t.hours)), 0).toFixed(2),
  );
  return { existing, hours, assignments, sold, advances };
}

const sumAmounts = (rows: { amount: Prisma.Decimal }[]) =>
  Number(rows.reduce((s, r) => s + Number(r.amount), 0).toFixed(2));

/**
 * Borrador de liquidación (no guarda nada): una línea por concepto que el
 * empleado tiene cargado — sueldo fijo, horas × valor hora, monto por evento
 * trabajado (cantidad = eventos del mes), comisión por evento vendido,
 * adelantos — con el cálculo de cada una. El admin edita todo antes de
 * confirmar (feedback 2026-10).
 */
export async function previewPayroll(
  tenantId: string,
  employeeId: string,
  periodInput: string,
): Promise<PayrollPreview> {
  return withTenant(tenantId, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.tenantId !== tenantId) throw new NotFoundError();
    const period = periodOf(periodInput);
    const ctx = await payrollContext(tx, tenantId, employeeId, period);

    const lines: PayrollLineInput[] = [];
    const fixed = Number(employee.fixedMonthlyAmount);
    if (fixed > 0) {
      lines.push({ kind: 'FIJO', description: 'Sueldo fijo', quantity: 1, unitAmount: fixed });
    }
    const hourlyRate = Number(employee.hourlyRate);
    if (hourlyRate > 0 || ctx.hours > 0) {
      lines.push({
        kind: 'HORAS',
        description: 'Horas del mes',
        quantity: ctx.hours,
        unitAmount: hourlyRate,
      });
    }
    if (employee.variableType === 'MONTO_POR_EVENTO') {
      lines.push({
        kind: 'POR_EVENTO',
        description: 'Monto por evento trabajado',
        quantity: ctx.assignments.length,
        unitAmount: Number(employee.variableValue),
      });
    } else if (employee.variableType === 'COMISION_PCT') {
      for (const a of ctx.assignments) {
        lines.push({
          kind: 'POR_EVENTO',
          description: `${Number(employee.variableValue)}% de ${a.event.name}`,
          quantity: 1,
          unitAmount: sumAmounts(a.event.expenses),
        });
      }
    }
    if (employee.saleCommissionType === 'MONTO_POR_EVENTO') {
      lines.push({
        kind: 'COMISION',
        description: 'Comisión por evento vendido',
        quantity: ctx.sold.length,
        unitAmount: Number(employee.saleCommissionValue),
      });
    } else if (employee.saleCommissionType === 'COMISION_PCT') {
      for (const e of ctx.sold) {
        const amount =
          e.expenses.length > 0
            ? sumAmounts(e.expenses)
            : await variableAmount(
                tx,
                tenantId,
                e.id,
                'COMISION_PCT',
                employee.saleCommissionValue,
              );
        lines.push({
          kind: 'COMISION',
          description: `Comisión ${Number(employee.saleCommissionValue)}% — ${e.name}`,
          quantity: 1,
          unitAmount: amount,
        });
      }
    }
    const advancesTotal = sumAmounts(ctx.advances);
    if (advancesTotal > 0) {
      lines.push({
        kind: 'ADELANTO',
        description: `Comisiones adelantadas (${ctx.advances.length})`,
        quantity: 1,
        unitAmount: advancesTotal,
      });
    }

    return {
      period: period.toISOString(),
      lines,
      existing: ctx.existing ? serializePayrollEntry(ctx.existing) : null,
      reference: {
        hours: ctx.hours,
        hourlyRate,
        eventsWorked: ctx.assignments.map((a) => ({
          id: a.event.id,
          name: a.event.name,
          date: a.event.eventDate?.toISOString() ?? null,
          costedAmount: sumAmounts(a.event.expenses),
        })),
        eventsSold: ctx.sold.map((e) => ({
          id: e.id,
          name: e.name,
          soldAt: (e.soldAt ?? e.createdAt).toISOString(),
          costedAmount: sumAmounts(e.expenses),
        })),
        advances: ctx.advances.map((a) => ({
          id: a.id,
          date: a.date.toISOString(),
          amount: Number(a.amount),
          note: a.note,
        })),
      },
    };
  });
}

const FIXED_KINDS = new Set(['FIJO', 'HORAS', 'OTRO']);
const VARIABLE_KINDS = new Set(['POR_EVENTO', 'COMISION']);

/**
 * Confirma la liquidación del mes con las líneas (editadas) del borrador.
 * Re-liquidar el mismo mes reemplaza la anterior. Vínculo con costeo: el
 * fijo + horas (+ otros) del mes pasa a ser un gasto del salón de ese mes
 * en el rubro del empleado, y se prorratea entre los eventos del mes como
 * cualquier gasto fijo. Lo por evento / comisiones ya está en el costeo de
 * cada evento (gastos auto-generados), así que no se vuelve a sumar.
 */
export async function confirmPayroll(
  tenantId: string,
  employeeId: string,
  input: PayrollConfirmInput,
): Promise<PayrollEntrySummary> {
  return withTenant(tenantId, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.tenantId !== tenantId) throw new NotFoundError();
    const period = periodOf(input.period);
    const ctx = await payrollContext(tx, tenantId, employeeId, period);

    const lines = input.lines.map((line, index) => {
      const amount = Number((line.quantity * line.unitAmount).toFixed(2));
      return { ...line, amount: line.kind === 'ADELANTO' ? -amount : amount, sortOrder: index };
    });
    const sum = (pred: (kind: string) => boolean) =>
      Number(
        lines
          .filter((l) => pred(l.kind))
          .reduce((s, l) => s + l.amount, 0)
          .toFixed(2),
      );
    const fixedComponent = sum((k) => FIXED_KINDS.has(k));
    const variableComponent = sum((k) => VARIABLE_KINDS.has(k));
    const advancesDeducted = -sum((k) => k === 'ADELANTO');

    const entry = await tx.payrollEntry.upsert({
      where: { employeeId_period: { employeeId, period } },
      update: { fixedComponent, variableComponent, advancesDeducted, note: input.note ?? null },
      create: {
        tenantId,
        employeeId,
        period,
        fixedComponent,
        variableComponent,
        advancesDeducted,
        note: input.note ?? null,
      },
    });
    await tx.payrollLine.deleteMany({ where: { payrollEntryId: entry.id } });
    await tx.payrollLine.createMany({
      data: lines.map((l) => ({
        tenantId,
        payrollEntryId: entry.id,
        kind: l.kind,
        description: l.description,
        quantity: l.quantity,
        unitAmount: l.unitAmount,
        amount: l.amount,
        sortOrder: l.sortOrder,
      })),
    });

    // Adelantos: quedan descontados en esta liquidación solo si tiene una
    // línea de adelanto; si el admin la sacó, vuelven a quedar pendientes.
    await tx.employeeCommissionAdvance.updateMany({
      where: { tenantId, reconciledInEntryId: entry.id },
      data: { reconciledInEntryId: null },
    });
    if (advancesDeducted > 0 && ctx.advances.length > 0) {
      await tx.employeeCommissionAdvance.updateMany({
        where: { id: { in: ctx.advances.map((a) => a.id) } },
        data: { reconciledInEntryId: entry.id },
      });
    }

    // Gasto del mes en costeo (fijo + horas + otros).
    const periodLabel = period.toISOString().slice(0, 7);
    const existingExpense = await tx.expense.findUnique({ where: { payrollEntryId: entry.id } });
    if (fixedComponent > 0) {
      const data = {
        tenantId,
        eventId: null,
        period,
        date: period,
        categoryId: employee.costCategoryId,
        employeeId,
        amount: fixedComponent,
        detail: `Liquidación ${employee.fullName} ${periodLabel} (fijo + horas)`,
        autoSource: 'PAYROLL' as const,
        payrollEntryId: entry.id,
      };
      if (existingExpense) {
        await tx.expense.update({ where: { id: existingExpense.id }, data });
      } else {
        await tx.expense.create({ data });
      }
    } else if (existingExpense) {
      await tx.expense.delete({ where: { id: existingExpense.id } });
    }

    const total = Number((fixedComponent + variableComponent - advancesDeducted).toFixed(2));
    await audit(tx, tenantId, {
      entityType: 'PayrollEntry',
      entityId: entry.id,
      action: ctx.existing ? 'UPDATE' : 'CREATE',
      summary: `Liquidación de ${employee.fullName} — ${periodLabel}: ${money(total)}`,
      changes: {
        periodo: periodLabel,
        lineas: lines.map((l) => `${l.description}: ${l.quantity} × ${l.unitAmount} = ${l.amount}`),
        fijo: fixedComponent,
        variable: variableComponent,
        adelantosDescontados: advancesDeducted,
        gastoEnCosteo: fixedComponent,
      },
    });

    const saved = await tx.payrollEntry.findUniqueOrThrow({
      where: { id: entry.id },
      include: PAYROLL_INCLUDE,
    });
    return serializePayrollEntry(saved);
  });
}

export async function listPayrollEntries(tenantId: string, employeeId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.payrollEntry.findMany({
      where: { tenantId, employeeId },
      include: PAYROLL_INCLUDE,
      orderBy: { period: 'desc' },
    });
    return rows.map(serializePayrollEntry);
  });
}
