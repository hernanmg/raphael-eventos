import type { Prisma } from '@prisma/client';
import type {
  CommissionAdvanceInput,
  EmployeeInput,
  EmployeeTimeEntryInput,
  EventStaffAssignmentInput,
  PayrollPeriodInput,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { computeAggregateFinancials } from '../../lib/financials';
import { generateTemporaryPassword, hashPassword } from '../../lib/password';

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

function serializeEmployee(row: {
  id: string;
  fullName: string;
  email: string | null;
  userId: string | null;
  contractType: string;
  fixedMonthlyAmount: Prisma.Decimal;
  variableType: string;
  variableValue: Prisma.Decimal;
  active: boolean;
}) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    hasDoorAccess: row.userId !== null,
    contractType: row.contractType,
    fixedMonthlyAmount: Number(row.fixedMonthlyAmount),
    variableType: row.variableType,
    variableValue: Number(row.variableValue),
    active: row.active,
  };
}

export async function listEmployees(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.employee.findMany({ where: { tenantId }, orderBy: { fullName: 'asc' } });
    return rows.map(serializeEmployee);
  });
}

export async function createEmployee(tenantId: string, input: EmployeeInput) {
  return withTenant(tenantId, async (tx) =>
    serializeEmployee(await tx.employee.create({ data: { tenantId, ...input } })),
  );
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

    return serializeEmployee(await tx.employee.update({ where: { id }, data: input }));
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

/**
 * Asigna un empleado a un evento (Básica). Si el empleado tiene componente
 * variable, genera sola la línea correspondiente en EventServiceCost
 * (autoGenerated: true) en vez de que el admin la cargue dos veces —
 * decisión ya cerrada en CLAUDE.md "Fase 2 — costeo y personal".
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
      let amount = Number(employee.variableValue);
      if (employee.variableType === 'COMISION_PCT') {
        const beneficiaries = await tx.eventBeneficiary.findMany({
          where: { tenantId, eventId },
          include: { cards: true, payments: true },
        });
        const ipcRows = await tx.ipcIndexValue.findMany({
          where: { tenantId },
          orderBy: { period: 'asc' },
        });
        const { totalValue } = computeAggregateFinancials(beneficiaries, ipcRows);
        amount = Number((totalValue * (Number(employee.variableValue) / 100)).toFixed(2));
      }

      await tx.eventServiceCost.create({
        data: {
          tenantId,
          eventId,
          employeeId: employee.id,
          autoGenerated: true,
          amount,
          note: employee.fullName,
        },
      });
    }

    return serializeAssignment(assignment);
  });
}

/**
 * Desasigna un empleado del evento. Borra también la línea de
 * EventServiceCost que se auto-generó al asignarlo — salvo que el admin la
 * haya editado a mano (manuallyEdited), en cuyo caso se deja tal cual.
 */
export async function unassignStaff(tenantId: string, assignmentId: string) {
  return withTenant(tenantId, async (tx) => {
    const assignment = await tx.eventStaffAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.tenantId !== tenantId) throw new NotFoundError();

    await tx.eventServiceCost.deleteMany({
      where: {
        tenantId,
        eventId: assignment.eventId,
        employeeId: assignment.employeeId,
        autoGenerated: true,
        manuallyEdited: false,
      },
    });

    await tx.eventStaffAssignment.delete({ where: { id: assignmentId } });
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
      include: { event: { select: { name: true } } },
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
      include: { event: { select: { name: true } } },
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

/**
 * Liquida un período (mes): fixedComponent = fijo completo del empleado;
 * variableComponent = suma de las líneas de EventServiceCost generadas por
 * sus asignaciones a eventos de ese mes; advancesDeducted = comisiones
 * adelantadas no reconciliadas todavía con fecha en ese mes — quedan
 * marcadas como reconciliadas contra la liquidación resultante.
 */
export async function computePayrollPeriod(
  tenantId: string,
  employeeId: string,
  input: PayrollPeriodInput,
) {
  return withTenant(tenantId, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.tenantId !== tenantId) throw new NotFoundError();

    const period = firstOfMonth(input.period);
    const { start, end } = monthRange(period);

    const assignments = await tx.eventStaffAssignment.findMany({
      where: { tenantId, employeeId, event: { eventDate: { gte: start, lt: end } } },
      select: { eventId: true },
    });
    const eventIds = assignments.map((a) => a.eventId);

    const serviceCosts = eventIds.length
      ? await tx.eventServiceCost.findMany({
          where: { tenantId, employeeId, eventId: { in: eventIds } },
        })
      : [];
    const variableComponent = Number(
      serviceCosts.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2),
    );

    const pendingAdvances = await tx.employeeCommissionAdvance.findMany({
      where: {
        tenantId,
        employeeId,
        reconciledInEntryId: null,
        date: { gte: start, lt: end },
      },
    });
    const advancesDeducted = Number(
      pendingAdvances.reduce((sum, a) => sum + Number(a.amount), 0).toFixed(2),
    );

    const entry = await tx.payrollEntry.upsert({
      where: { employeeId_period: { employeeId, period } },
      update: {
        fixedComponent: employee.fixedMonthlyAmount,
        variableComponent,
        advancesDeducted,
      },
      create: {
        tenantId,
        employeeId,
        period,
        fixedComponent: employee.fixedMonthlyAmount,
        variableComponent,
        advancesDeducted,
      },
    });

    if (pendingAdvances.length) {
      await tx.employeeCommissionAdvance.updateMany({
        where: { id: { in: pendingAdvances.map((a) => a.id) } },
        data: { reconciledInEntryId: entry.id },
      });
    }

    return serializePayrollEntry(entry);
  });
}

function serializePayrollEntry(row: {
  id: string;
  period: Date;
  fixedComponent: Prisma.Decimal;
  variableComponent: Prisma.Decimal;
  advancesDeducted: Prisma.Decimal;
  note: string | null;
}) {
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
  };
}

export async function listPayrollEntries(tenantId: string, employeeId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.payrollEntry.findMany({
      where: { tenantId, employeeId },
      orderBy: { period: 'desc' },
    });
    return rows.map(serializePayrollEntry);
  });
}
