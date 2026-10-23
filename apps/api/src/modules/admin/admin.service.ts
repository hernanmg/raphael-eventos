import { BASE_CARD_TYPES } from '@raphael-eventos/shared';
import type {
  AddCardTypeInput,
  AdminEventDetail,
  BeneficiaryReport,
  ClientDetail,
  ClientListItem,
  CancelEventInput,
  CardAdjustmentInput,
  CardHistory,
  CardValuePoint,
  CreateEventInput,
  CreateIpcEntryInput,
  DashboardSummary,
  IpcHistoryEntry,
  RecordPaymentInput,
  RecordPaymentResult,
  UpdateEventInput,
  UpdateIpcEntryInput,
} from '@raphael-eventos/shared';
import type { CardType as CardTypeValue, Prisma } from '@prisma/client';
import { withTenant } from '../../db/withTenant';
import { audit, diffFields, money, snapshot } from '../../lib/audit';
import { generateTemporaryPassword, hashPassword } from '../../lib/password';
import { syncSaleCommission } from '../staff/staff.service';
import {
  chargeableMinimum,
  computeAggregateFinancials,
  computeBeneficiaryFinancials,
  currentUnitValue,
  paidByType,
  serializeCard,
  serializePayment,
  type IpcRow,
} from '../../lib/financials';

export class EventNotFoundError extends Error {}
export class BeneficiaryNotFoundError extends Error {}
export class InvalidAllocationError extends Error {}
export class ClientNotFoundError extends Error {}
export class CardNotFoundError extends Error {}
export class InvalidCardAdjustmentError extends Error {}
export class InvalidCancellationError extends Error {}
export class IpcEntryNotFoundError extends Error {}
export class IpcEntryNotEditableError extends Error {}

function firstOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function firstOfMonth(dateLike: string): Date {
  const d = new Date(dateLike);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function createCardsForBeneficiary(
  tx: Prisma.TransactionClient,
  tenantId: string,
  beneficiaryId: string,
  cards: CreateEventInput['cards'],
  basePeriod: Date,
) {
  // Adulto/adolescente/menor existen siempre, aunque vengan en 0 o no vengan
  // (feedback 2026-10-23): se completan después con "Ajustar".
  const all = [
    ...cards,
    ...BASE_CARD_TYPES.filter((type) => !cards.some((c) => c.cardType === type)).map(
      (cardType) => ({ cardType, quantity: 0, baseValue: 0 }),
    ),
  ];
  for (const card of all) {
    // Cantidad 0 con valor cargado sí se crea: la cantidad sube sola al
    // asignar pagos. Brindis sin cantidad ni valor no aplica.
    const isBase = (BASE_CARD_TYPES as readonly string[]).includes(card.cardType);
    if (!isBase && card.quantity <= 0 && card.baseValue <= 0) continue;
    await tx.eventCard.create({
      data: {
        tenantId,
        beneficiaryId,
        cardType: card.cardType,
        quantity: card.quantity,
        baseValue: card.baseValue,
        basePeriod,
      },
    });
  }
}

/**
 * Si ya existe una cuenta con ese email en el tenant, la vincula al toque
 * (no hace falta esperar a que se registre). Simétrico a
 * auth.service.ts#linkPendingEvents, que resuelve el caso inverso (usuario
 * nuevo, eventos ya cargados) — mismas reglas de negocio, dos disparadores
 * distintos (alta de evento acá, registro allá).
 */
async function linkExistingAccountByEmail(
  tx: Prisma.TransactionClient,
  tenantId: string,
  email: string,
  eventId: string,
  beneficiaryId: string | null,
  role: 'TITULAR' | 'PARTICIPANTE',
) {
  const user = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
  if (!user) return;

  const existingLink = await tx.eventAccount.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  });
  if (existingLink) return;

  await tx.eventAccount.create({
    data: { tenantId, eventId, userId: user.id, beneficiaryId, role },
  });

  if (beneficiaryId && role === 'PARTICIPANTE') {
    await tx.eventBeneficiary.update({
      where: { id: beneficiaryId },
      data: { accountId: user.id },
    });
  }
}

export class InvalidSellerError extends Error {}

/** El vendedor tiene que ser un empleado del tenant. */
async function assertSeller(
  tx: Prisma.TransactionClient,
  tenantId: string,
  employeeId: string | undefined,
): Promise<string | null> {
  if (!employeeId) return null;
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.tenantId !== tenantId) throw new InvalidSellerError();
  return employee.id;
}

export async function createEvent(tenantId: string, adminUserId: string, input: CreateEventInput) {
  return withTenant(tenantId, async (tx) => {
    const basePeriod = firstOfCurrentMonth();

    const event = await tx.event.create({
      data: {
        tenantId,
        type: input.type,
        name: input.name,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        titularName: input.titularName ?? null,
        titularEmail: input.titularEmail,
        minGuests: input.minGuests ?? null,
        soldByEmployeeId: await assertSeller(tx, tenantId, input.soldByEmployeeId),
        soldAt: input.soldByEmployeeId
          ? input.soldAt
            ? new Date(input.soldAt)
            : new Date()
          : null,
        createdById: adminUserId,
      },
    });

    if (input.type === 'EGRESO') {
      for (const alumno of input.alumnos) {
        const beneficiary = await tx.eventBeneficiary.create({
          data: {
            tenantId,
            eventId: event.id,
            label: alumno.label,
            contactEmail: alumno.contactEmail ?? null,
            contactPhone: alumno.contactPhone ?? null,
          },
        });
        await createCardsForBeneficiary(tx, tenantId, beneficiary.id, input.cards, basePeriod);
        if (alumno.contactEmail) {
          await linkExistingAccountByEmail(
            tx,
            tenantId,
            alumno.contactEmail,
            event.id,
            beneficiary.id,
            'PARTICIPANTE',
          );
        }
      }
      // Titular del egreso (colegio/comisión): agregado, sin beneficiary propio.
      await linkExistingAccountByEmail(tx, tenantId, input.titularEmail, event.id, null, 'TITULAR');
    } else {
      const beneficiary = await tx.eventBeneficiary.create({
        data: { tenantId, eventId: event.id },
      });
      await createCardsForBeneficiary(tx, tenantId, beneficiary.id, input.cards, basePeriod);
      await linkExistingAccountByEmail(
        tx,
        tenantId,
        input.titularEmail,
        event.id,
        beneficiary.id,
        'TITULAR',
      );
    }

    await audit(tx, tenantId, {
      entityType: 'Event',
      entityId: event.id,
      eventId: event.id,
      action: 'CREATE',
      summary: `Alta del evento "${event.name}"`,
      changes: {
        ...snapshot(event, [
          'type',
          'name',
          'eventDate',
          'titularName',
          'titularEmail',
          'minGuests',
        ]),
        tarjetas: input.cards
          .filter((card) => card.quantity > 0 || card.baseValue > 0)
          .map((card) => ({
            tipo: card.cardType,
            cantidad: card.quantity,
            valorBase: card.baseValue,
          })),
        ...(input.type === 'EGRESO' ? { alumnos: input.alumnos.length } : {}),
        ...(event.soldByEmployeeId ? { vendidoPor: event.soldByEmployeeId } : {}),
      },
    });

    // Con las tarjetas ya creadas (la comisión % sale del valor del evento).
    await syncSaleCommission(tx, tenantId, event.id);

    return event;
  });
}

/**
 * Edición de un evento ya creado (Fase 4). El tipo no se edita. Cambiar el
 * titular re-vincula el portal: `linkExistingAccountByEmail` solo AGREGA
 * vínculos, así que sin esto el titular viejo seguiría viendo el evento.
 * Se borra el EventAccount TITULAR anterior y se vincula el nuevo si ya
 * tiene cuenta (si no, lo agarra auth.service.ts#linkPendingEvents al
 * registrarse, que busca por Event.titularEmail).
 */
export async function updateEvent(tenantId: string, eventId: string, input: UpdateEventInput) {
  return withTenant(tenantId, async (tx) => {
    const before = await tx.event.findUnique({
      where: { id: eventId },
      include: { beneficiaries: { select: { id: true }, take: 2 } },
    });
    if (!before || before.tenantId !== tenantId) throw new EventNotFoundError();

    const reactivated = before.status === 'CANCELADO' && input.status !== 'CANCELADO';
    const data = {
      name: input.name,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      titularName: input.titularName ?? null,
      titularEmail: input.titularEmail,
      titularPhone: input.titularPhone ?? null,
      minGuests: input.minGuests ?? null,
      status: input.status,
      // Reactivar un cancelado limpia la baja (queda en la auditoría). Cancelar
      // desde acá (sin motivo) sigue andando, pero la UI usa cancelEvent.
      ...(reactivated
        ? { cancelledAt: null, cancellationReason: null, refundAmount: null }
        : before.status !== 'CANCELADO' && input.status === 'CANCELADO'
          ? { cancelledAt: new Date() }
          : {}),
      soldByEmployeeId: await assertSeller(tx, tenantId, input.soldByEmployeeId),
      soldAt: input.soldByEmployeeId
        ? input.soldAt
          ? new Date(input.soldAt)
          : (before.soldAt ?? new Date())
        : null,
    };
    const changes = diffFields(before, data, [
      'name',
      'eventDate',
      'titularName',
      'titularEmail',
      'titularPhone',
      'minGuests',
      'status',
      'soldByEmployeeId',
      'soldAt',
      'cancelledAt',
      'cancellationReason',
      'refundAmount',
    ]);
    if (!changes) return before;

    const event = await tx.event.update({ where: { id: eventId }, data });

    // Vendedor, fecha de venta o estado (cancelado) cambian la comisión.
    if (changes.soldByEmployeeId || changes.soldAt || changes.status) {
      await syncSaleCommission(tx, tenantId, eventId);
    }

    if (before.titularEmail !== input.titularEmail) {
      await tx.eventAccount.deleteMany({ where: { tenantId, eventId, role: 'TITULAR' } });
      const beneficiaryId = before.type === 'EGRESO' ? null : (before.beneficiaries[0]?.id ?? null);
      await linkExistingAccountByEmail(
        tx,
        tenantId,
        input.titularEmail,
        eventId,
        beneficiaryId,
        'TITULAR',
      );
    }

    const statusChanged = before.status !== input.status;
    await audit(tx, tenantId, {
      entityType: 'Event',
      entityId: eventId,
      eventId,
      action: 'UPDATE',
      summary: statusChanged
        ? `Evento "${event.name}" pasó a ${input.status}`
        : `Edición del evento "${event.name}"`,
      changes,
    });
    return event;
  });
}

/**
 * Baja de un evento (feedback 2026-10-23: un cliente llamó cancelando y no
 * había forma visible de darlo de baja). Mismo efecto que pasar el estado a
 * CANCELADO (sale de calendario, reportes, micrositio, check-in,
 * recordatorios y comisión) + motivo y monto devuelto opcional. Los pagos no
 * se tocan: quedan como historial, y la cobranza de reportes resta la
 * devolución en el mes de la baja.
 */
export async function cancelEvent(tenantId: string, eventId: string, input: CancelEventInput) {
  return withTenant(tenantId, async (tx) => {
    const before = await tx.event.findUnique({
      where: { id: eventId },
      include: { beneficiaries: { include: { payments: { select: { amount: true } } } } },
    });
    if (!before || before.tenantId !== tenantId) throw new EventNotFoundError();
    if (before.status === 'CANCELADO') {
      throw new InvalidCancellationError('El evento ya está cancelado');
    }
    const totalPaid = before.beneficiaries
      .flatMap((b) => b.payments)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const refundAmount = input.refundAmount ?? 0;
    if (refundAmount > totalPaid + 0.005) {
      throw new InvalidCancellationError(
        `La devolución no puede superar lo cobrado (${money(totalPaid)})`,
      );
    }

    const event = await tx.event.update({
      where: { id: eventId },
      data: {
        status: 'CANCELADO',
        cancelledAt: new Date(),
        cancellationReason: input.reason,
        refundAmount: refundAmount > 0 ? refundAmount : null,
      },
    });
    await syncSaleCommission(tx, tenantId, eventId);

    await audit(tx, tenantId, {
      entityType: 'Event',
      entityId: eventId,
      eventId,
      action: 'UPDATE',
      summary: `Baja del evento "${event.name}": ${input.reason}${refundAmount > 0 ? ` (devolución ${money(refundAmount)})` : ''}`,
      changes: {
        status: { de: before.status, a: 'CANCELADO' },
        motivo: input.reason,
        cobrado: Number(totalPaid.toFixed(2)),
        devolucion: refundAmount,
      },
    });
    return event;
  });
}

/**
 * "Agregar tipo de tarjeta" a un evento ya creado (feedback 2026-10-23: el
 * evento real se había creado sin Menores). Se agrega a cada beneficiary que
 * no lo tenga (en egreso, a todos los alumnos con la misma cantidad y valor),
 * con período base = mes actual.
 */
export async function addCardType(tenantId: string, eventId: string, input: AddCardTypeInput) {
  return withTenant(tenantId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { beneficiaries: { include: { cards: { select: { cardType: true } } } } },
    });
    if (!event || event.tenantId !== tenantId) throw new EventNotFoundError();
    const missing = event.beneficiaries.filter(
      (b) => !b.cards.some((c) => c.cardType === input.cardType),
    );
    if (missing.length === 0) {
      throw new InvalidCardAdjustmentError('El evento ya tiene ese tipo de tarjeta');
    }

    const basePeriod = firstOfCurrentMonth();
    for (const beneficiary of missing) {
      const card = await tx.eventCard.create({
        data: {
          tenantId,
          beneficiaryId: beneficiary.id,
          cardType: input.cardType,
          quantity: input.quantity,
          baseValue: input.unitValue,
          basePeriod,
        },
      });
      const who = beneficiary.label ? ` (${beneficiary.label})` : '';
      await audit(tx, tenantId, {
        entityType: 'EventCard',
        entityId: card.id,
        eventId,
        action: 'CREATE',
        summary: `Tipo de tarjeta agregado: ${input.cardType}${who}`,
        changes: {
          cantidad: { de: null, a: input.quantity },
          valorBase: { de: null, a: input.unitValue },
          periodoBase: { de: null, a: basePeriod.toISOString() },
        },
      });
    }
    return { added: missing.length };
  });
}

/**
 * Ajuste MANUAL de una tarjeta (renegociación) — Fase 4. Nunca un UPDATE
 * suelto: deja un EventCardAdjustment (append-only en la base) con el
 * antes/después + motivo, y re-basa la tarjeta: `baseValue` = valor vigente
 * desde hoy, `basePeriod` = mes actual (desde ahí sigue indexando por IPC).
 * Así el saldo es reconstruible: IPC → IpcIndexValue, manual → acá. No deja
 * bajar la cantidad por debajo de las unidades ya asignadas a pagos.
 */
export async function adjustCard(
  tenantId: string,
  cardId: string,
  adminUserId: string,
  input: CardAdjustmentInput,
) {
  return withTenant(tenantId, async (tx) => {
    const card = await tx.eventCard.findUnique({
      where: { id: cardId },
      include: { beneficiary: { select: { id: true, label: true, eventId: true } } },
    });
    if (!card || card.tenantId !== tenantId) throw new CardNotFoundError();

    const allocated = await tx.paymentCardAllocation.aggregate({
      where: { tenantId, cardType: card.cardType, payment: { beneficiaryId: card.beneficiaryId } },
      _sum: { quantity: true },
    });
    const paidUnits = allocated._sum.quantity ?? 0;
    if (input.quantity < paidUnits) {
      throw new InvalidCardAdjustmentError(
        `Ya hay ${paidUnits} tarjeta(s) de este tipo asignadas a pagos — la cantidad no puede ser menor`,
      );
    }

    const newBasePeriod = firstOfCurrentMonth();
    const adjustment = await tx.eventCardAdjustment.create({
      data: {
        tenantId,
        cardId,
        previousQuantity: card.quantity,
        newQuantity: input.quantity,
        previousBaseValue: card.baseValue,
        newBaseValue: input.unitValue,
        previousBasePeriod: card.basePeriod,
        newBasePeriod,
        reason: input.reason,
        createdById: adminUserId,
      },
    });
    await tx.eventCard.update({
      where: { id: cardId },
      data: { quantity: input.quantity, baseValue: input.unitValue, basePeriod: newBasePeriod },
    });

    const who = card.beneficiary.label ? ` (${card.beneficiary.label})` : '';
    await audit(tx, tenantId, {
      entityType: 'EventCard',
      entityId: cardId,
      eventId: card.beneficiary.eventId,
      action: 'UPDATE',
      summary: `Ajuste manual de tarjeta ${card.cardType}${who}: ${input.reason}`,
      changes: {
        ajusteId: adjustment.id,
        tipo: 'MANUAL',
        motivo: input.reason,
        cantidad: { de: card.quantity, a: input.quantity },
        valorBase: { de: Number(card.baseValue), a: input.unitValue },
        periodoBase: { de: card.basePeriod.toISOString(), a: newBasePeriod.toISOString() },
      },
    });
    return adjustment;
  });
}

/**
 * Historial de una tarjeta (feedback 2026-10-23: click en "Pagas 18/40"):
 * qué pagos cubrieron esas 18 y a qué valor quedaron congeladas, y cómo fue
 * cambiando el valor unitario — alta, cada IPC y cada ajuste manual que
 * cambió el valor (los aumentos automáticos de cantidad no cambian el valor
 * y no aparecen acá). Se reconstruye de IpcIndexValue + EventCardAdjustment:
 * no hay una tabla de valores guardados.
 */
export async function getCardHistory(tenantId: string, cardId: string): Promise<CardHistory> {
  return withTenant(tenantId, async (tx) => {
    const card = await tx.eventCard.findUnique({
      where: { id: cardId },
      include: {
        adjustments: { orderBy: { createdAt: 'asc' } },
        beneficiary: {
          include: {
            payments: { include: { allocations: true }, orderBy: { paymentDate: 'asc' } },
          },
        },
      },
    });
    if (!card || card.tenantId !== tenantId) throw new CardNotFoundError();
    const ipcRows = await tx.ipcIndexValue.findMany({
      where: { tenantId },
      orderBy: { period: 'asc' },
    });

    const payments = card.beneficiary.payments;
    const summary = serializeCard(card, ipcRows, paidByType(payments).get(card.cardType));
    const allocations = payments.flatMap((payment) =>
      payment.allocations
        .filter((a) => a.cardType === card.cardType)
        .map((a) => ({
          paymentId: payment.id,
          paymentDate: payment.paymentDate.toISOString(),
          paymentAmount: Number(payment.amount),
          note: payment.note,
          quantity: a.quantity,
          unitValue: Number(a.unitValue),
          subtotal: Number((a.quantity * Number(a.unitValue)).toFixed(2)),
        })),
    );

    // Tramos de valor: el original y uno por cada ajuste que lo re-basó.
    const valueAdjustments = card.adjustments.filter(
      (a) =>
        !a.previousBaseValue.equals(a.newBaseValue) ||
        a.previousBasePeriod.getTime() !== a.newBasePeriod.getTime(),
    );
    const segments = [
      {
        baseValue: Number(valueAdjustments[0]?.previousBaseValue ?? card.baseValue),
        basePeriod: valueAdjustments[0]?.previousBasePeriod ?? card.basePeriod,
        kind: 'ALTA' as const,
        reason: null as string | null,
      },
      ...valueAdjustments.map((a) => ({
        baseValue: Number(a.newBaseValue),
        basePeriod: a.newBasePeriod,
        kind: 'AJUSTE' as const,
        reason: a.reason,
      })),
    ];

    const valueHistory: CardValuePoint[] = [];
    segments.forEach((segment, i) => {
      valueHistory.push({
        period: segment.basePeriod.toISOString(),
        unitValue: segment.baseValue,
        kind: segment.kind,
        variationPct: null,
        reason: segment.reason,
      });
      const until = segments[i + 1]?.basePeriod;
      // Un IPC de un mes posterior al período base es el que mueve el valor
      // (mismo criterio que indexFactor).
      for (const row of ipcRows) {
        if (row.period.getTime() <= segment.basePeriod.getTime()) continue;
        if (until && row.period.getTime() >= until.getTime()) break;
        const rowsSoFar: IpcRow[] = ipcRows.filter(
          (r) => r.period.getTime() <= row.period.getTime(),
        );
        valueHistory.push({
          period: row.period.toISOString(),
          unitValue: currentUnitValue(
            { ...card, baseValue: segment.baseValue, basePeriod: segment.basePeriod },
            rowsSoFar,
          ),
          kind: 'IPC',
          variationPct: Number(row.sourceLatestValue),
          reason: null,
        });
      }
    });

    return { card: summary, allocations: allocations.reverse(), valueHistory };
  });
}

export async function getDashboard(tenantId: string): Promise<DashboardSummary> {
  return withTenant(tenantId, async (tx) => {
    const events = await tx.event.findMany({ where: { tenantId }, orderBy: { eventDate: 'asc' } });

    const totals = { total: events.length, QUINCE: 0, EGRESO: 0, BODA: 0, EMPRESARIAL: 0 };
    for (const event of events) {
      totals[event.type] += 1;
    }

    return {
      totals,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        type: event.type,
        eventDate: event.eventDate?.toISOString() ?? null,
        status: event.status,
      })),
    };
  });
}

/**
 * Detalle de evento para el panel admin — a diferencia del portal cliente,
 * el staff ve el desglose de TODOS los beneficiaries (incluidas todas las
 * familias de un egreso, no solo el agregado): no aplica la restricción de
 * privacidad entre titular y participantes, esa es una regla del portal
 * cliente, no del acceso interno del salón.
 */
export async function getEventDetailForAdmin(
  tenantId: string,
  eventId: string,
): Promise<AdminEventDetail> {
  return withTenant(tenantId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { soldByEmployee: { select: { fullName: true } } },
    });
    if (!event || event.tenantId !== tenantId) {
      throw new EventNotFoundError();
    }

    const [beneficiaries, ipcRows] = await Promise.all([
      tx.eventBeneficiary.findMany({
        where: { tenantId, eventId },
        include: {
          cards: true,
          payments: { include: { allocations: true }, orderBy: { paymentDate: 'desc' } },
        },
      }),
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
    ]);

    let totalValue = 0;
    let totalPaid = 0;
    const minGuests = chargeableMinimum(event);
    const beneficiaryDetails = beneficiaries.map((beneficiary) => {
      const financials = computeBeneficiaryFinancials(beneficiary, ipcRows, minGuests);
      totalValue += financials.totalValue;
      totalPaid += financials.totalPaid;
      return {
        id: beneficiary.id,
        label: beneficiary.label,
        contactEmail: beneficiary.contactEmail,
        linked: beneficiary.accountId !== null,
        ...financials,
        payments: beneficiary.payments.map(serializePayment),
      };
    });
    totalValue = Number(totalValue.toFixed(2));
    totalPaid = Number(totalPaid.toFixed(2));

    return {
      id: event.id,
      type: event.type,
      name: event.name,
      eventDate: event.eventDate?.toISOString() ?? null,
      startTime: event.startTime,
      photosUrl: event.photosUrl,
      status: event.status,
      titularName: event.titularName,
      titularEmail: event.titularEmail,
      titularPhone: event.titularPhone,
      minGuests: event.minGuests,
      soldByEmployeeId: event.soldByEmployeeId,
      soldByEmployeeName: event.soldByEmployee?.fullName ?? null,
      soldAt: event.soldAt?.toISOString() ?? null,
      cancelledAt: event.cancelledAt?.toISOString() ?? null,
      cancellationReason: event.cancellationReason,
      refundAmount: event.refundAmount === null ? null : Number(event.refundAmount),
      latestIpcPeriod: ipcRows.at(-1)?.period.toISOString() ?? null,
      beneficiaries: beneficiaryDetails,
      totals: {
        totalValue,
        totalPaid,
        saldo: Number((totalValue - totalPaid).toFixed(2)),
        percentPaid: totalValue > 0 ? Number(((totalPaid / totalValue) * 100).toFixed(1)) : 0,
      },
    };
  });
}

export async function listIpcHistory(tenantId: string): Promise<IpcHistoryEntry[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.ipcIndexValue.findMany({
      where: { tenantId },
      orderBy: { period: 'desc' },
      include: { triggeredBy: { select: { fullName: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      period: row.period.toISOString(),
      indexValue: Number(row.indexValue),
      sourcePreviousValue: Number(row.sourcePreviousValue),
      sourceLatestValue: Number(row.sourceLatestValue),
      fetchedAt: row.fetchedAt.toISOString(),
      triggeredByName: row.triggeredBy?.fullName ?? null,
    }));
  });
}

/**
 * Carga manual de un período de IPC — coexiste con el job automático (ver
 * lib/ipc.ts) para cuando el admin necesita cargar un período a mano (falta
 * de conectividad, IPC todavía no publicado pasado el día 14, etc.).
 *
 * `variationPct` son puntos porcentuales de variación intermensual (el mismo
 * dato que devuelve la serie de datos.gob.ar — ej. 2.11 significa +2.11% ese
 * mes), **no niveles de índice**. Se guarda en `sourceLatestValue`;
 * `sourcePreviousValue` (solo referencia/auditoría, mismo criterio que el
 * cron) se completa con la variación del mes anterior ya guardada — el form
 * pedía los dos valores aunque solo uno entraba en el cálculo. El
 * encadenamiento es `índice_nuevo = índice_del_mes_anterior × (1 +
 * variación/100)`, arrancando en 100 si es el primer período del tenant. La
 * base es la última fila **anterior** al período cargado, no la última a
 * secas: si no, re-cargar el último mes (corregir un valor mal tipeado)
 * encadenaba sobre sí mismo y aplicaba la variación dos veces.
 *
 * **Corregido en esta sesión**: la fórmula original (heredada de Fase 1)
 * hacía `sourceLatestValue / sourcePreviousValue`, que sería correcta si la
 * serie fuera de niveles de índice — pero la serie real
 * (145.3_INGNACUAL_DICI_M_38) es de variación intermensual, confirmado
 * consultando la API real: `{"field":{"units":"Variación intermensual",...
 * "description":"IPC. Tasa de variación mensual..."}}`. Con la fórmula vieja,
 * dos meses de inflación real (ej. 1.9% y 2.1%) daban una "variación" de
 * 2.1/1.9 ≈ 1.105 — un 10.5% en vez de 2.1%, un error real de cálculo sobre
 * plata de clientes.
 */
export async function addIpcEntry(
  tenantId: string,
  adminUserId: string,
  input: CreateIpcEntryInput,
): Promise<IpcHistoryEntry> {
  return withTenant(tenantId, async (tx) => {
    const period = firstOfMonth(input.period);

    const previousRow = await tx.ipcIndexValue.findFirst({
      where: { tenantId, period: { lt: period } },
      orderBy: { period: 'desc' },
    });
    const baseIndex = previousRow ? Number(previousRow.indexValue) : 100;
    const indexValue = Number((baseIndex * (1 + input.variationPct / 100)).toFixed(6));
    const previousVariation = previousRow
      ? Number(previousRow.sourceLatestValue)
      : input.variationPct;

    const row = await tx.ipcIndexValue.upsert({
      where: { tenantId_period: { tenantId, period } },
      update: {
        indexValue,
        sourcePreviousValue: previousVariation,
        sourceLatestValue: input.variationPct,
        triggeredById: adminUserId,
        fetchedAt: new Date(),
      },
      create: {
        tenantId,
        period,
        indexValue,
        sourcePreviousValue: previousVariation,
        sourceLatestValue: input.variationPct,
        triggeredById: adminUserId,
      },
      include: { triggeredBy: { select: { fullName: true } } },
    });

    // Cargar un mes que no es el último (o re-cargarlo) cambia la base de los
    // meses siguientes: sin esto quedaban encadenados sobre el valor viejo.
    const recalculated = await rechainIpcAfter(tx, tenantId, period);

    await audit(tx, tenantId, {
      entityType: 'IpcIndexValue',
      entityId: row.id,
      action: 'CREATE',
      summary: `IPC cargado a mano para ${period.toISOString().slice(0, 7)}: ${input.variationPct >= 0 ? '+' : ''}${input.variationPct}%`,
      changes: {
        periodo: period.toISOString(),
        variacionPct: input.variationPct,
        variacionAnteriorPct: previousVariation,
        indiceAnterior: baseIndex,
        indiceResultante: indexValue,
        origen: 'MANUAL',
        mesesRecalculados: recalculated,
      },
    });

    return serializeIpcRow(row);
  });
}

function serializeIpcRow(row: {
  id: string;
  period: Date;
  indexValue: Prisma.Decimal;
  sourcePreviousValue: Prisma.Decimal;
  sourceLatestValue: Prisma.Decimal;
  fetchedAt: Date;
  triggeredBy?: { fullName: string } | null;
}): IpcHistoryEntry {
  return {
    id: row.id,
    period: row.period.toISOString(),
    indexValue: Number(row.indexValue),
    sourcePreviousValue: Number(row.sourcePreviousValue),
    sourceLatestValue: Number(row.sourceLatestValue),
    fetchedAt: row.fetchedAt.toISOString(),
    triggeredByName: row.triggeredBy?.fullName ?? null,
  };
}

/**
 * Re-encadena los índices de los meses POSTERIORES a `period` con la misma
 * regla que el cron y la carga manual: `índice(m) = índice(mes anterior
 * guardado) × (1 + variación(m)/100)`. El primer mes del tenant es el ancla y
 * no se toca (solo importa la proporción entre índices). Las tarjetas pagas no
 * se ven afectadas: su valor está congelado en la asignación del pago.
 * Devuelve cuántos meses cambiaron.
 */
async function rechainIpcAfter(
  tx: Prisma.TransactionClient,
  tenantId: string,
  period: Date,
): Promise<number> {
  const rows = await tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } });
  let changed = 0;
  // Índice del mes anterior ya corregido: cada mes encadena sobre ese valor.
  let previousIndex = rows.length ? Number(rows[0]!.indexValue) : 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const previousVariation = Number(rows[i - 1]!.sourceLatestValue);
    if (row.period.getTime() <= period.getTime()) {
      previousIndex = Number(row.indexValue);
      continue;
    }
    const indexValue = Number(
      (previousIndex * (1 + Number(row.sourceLatestValue) / 100)).toFixed(6),
    );
    if (Math.abs(Number(row.indexValue) - indexValue) > 1e-6) {
      await tx.ipcIndexValue.update({
        where: { id: row.id },
        data: { indexValue, sourcePreviousValue: previousVariation },
      });
      changed += 1;
    }
    previousIndex = indexValue;
  }
  return changed;
}

async function findManualIpcRow(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const row = await tx.ipcIndexValue.findUnique({ where: { id } });
  if (!row || row.tenantId !== tenantId) throw new IpcEntryNotFoundError();
  // Lo traído de datos.gob.ar (cron o backfill) es el dato oficial del INDEC:
  // solo se corrige lo que cargó una persona.
  if (!row.triggeredById) throw new IpcEntryNotEditableError();
  return row;
}

/**
 * Corrección de un mes cargado a mano (feedback 2026-10-23: "si me equivoco
 * queda fijo"). Recalcula el índice del mes y re-encadena los siguientes.
 */
export async function updateIpcEntry(
  tenantId: string,
  adminUserId: string,
  id: string,
  input: UpdateIpcEntryInput,
): Promise<IpcHistoryEntry> {
  return withTenant(tenantId, async (tx) => {
    const before = await findManualIpcRow(tx, tenantId, id);
    const previousRow = await tx.ipcIndexValue.findFirst({
      where: { tenantId, period: { lt: before.period } },
      orderBy: { period: 'desc' },
    });
    // Sin mes anterior es el ancla de la cadena: el índice no cambia.
    const indexValue = previousRow
      ? Number((Number(previousRow.indexValue) * (1 + input.variationPct / 100)).toFixed(6))
      : Number(before.indexValue);
    const row = await tx.ipcIndexValue.update({
      where: { id },
      data: {
        indexValue,
        sourceLatestValue: input.variationPct,
        triggeredById: adminUserId,
        fetchedAt: new Date(),
      },
      include: { triggeredBy: { select: { fullName: true } } },
    });
    const recalculated = await rechainIpcAfter(tx, tenantId, before.period);

    await audit(tx, tenantId, {
      entityType: 'IpcIndexValue',
      entityId: id,
      action: 'UPDATE',
      summary: `Corrección del IPC de ${before.period.toISOString().slice(0, 7)}: ${Number(before.sourceLatestValue)}% → ${input.variationPct}%`,
      changes: {
        periodo: before.period.toISOString(),
        variacionPct: { de: Number(before.sourceLatestValue), a: input.variationPct },
        indice: { de: Number(before.indexValue), a: indexValue },
        mesesRecalculados: recalculated,
      },
    });
    return serializeIpcRow(row);
  });
}

/** Baja de un mes cargado a mano (ej. se cargó en el mes equivocado). */
export async function deleteIpcEntry(tenantId: string, id: string): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    const row = await findManualIpcRow(tx, tenantId, id);
    await tx.ipcIndexValue.delete({ where: { id } });
    const recalculated = await rechainIpcAfter(tx, tenantId, row.period);
    await audit(tx, tenantId, {
      entityType: 'IpcIndexValue',
      entityId: id,
      action: 'DELETE',
      summary: `Baja del IPC cargado a mano de ${row.period.toISOString().slice(0, 7)} (${Number(row.sourceLatestValue)}%)`,
      changes: {
        periodo: row.period.toISOString(),
        variacionPct: Number(row.sourceLatestValue),
        indice: Number(row.indexValue),
        mesesRecalculados: recalculated,
      },
    });
  });
}

/**
 * Alta de un pago — todo se cobra en persona (efectivo/transferencia), el
 * cliente nunca carga esto: siempre es Cami o Fede desde el panel admin, acá
 * es donde faltaba el endpoint (Fase 1 solo tenía lectura de `payments`, no
 * alta — hueco real encontrado probando la app).
 *
 * `input.allocations` es opcional (ver CLAUDE.md "Fase 2 — asignación de
 * pagos"). Desde el feedback 2026-10-23:
 *  - cada tarjeta asignada queda CONGELADA al valor vigente hoy
 *    (`PaymentCardAllocation.unitValue`): deja de indexar por IPC;
 *  - si se asignan más unidades de las cargadas, la cantidad de la tarjeta
 *    sube sola (al firmar no saben cuántos invitados van a tener) — queda un
 *    EventCardAdjustment con el motivo, sin re-basar el valor.
 */
export async function recordPayment(
  tenantId: string,
  beneficiaryId: string,
  adminUserId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  return withTenant(tenantId, async (tx) => {
    const beneficiary = await tx.eventBeneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        cards: true,
        payments: { include: { allocations: true } },
        event: { select: { type: true, minGuests: true } },
      },
    });
    if (!beneficiary || beneficiary.tenantId !== tenantId) {
      throw new BeneficiaryNotFoundError();
    }

    const ipcRows = await tx.ipcIndexValue.findMany({
      where: { tenantId },
      orderBy: { period: 'asc' },
    });

    const paid = paidByType(beneficiary.payments);
    const allocationRows: { cardType: CardTypeValue; quantity: number; unitValue: number }[] = [];
    const quantityRaises: { cardType: string; de: number; a: number }[] = [];
    for (const allocation of input.allocations) {
      const card = beneficiary.cards.find((c) => c.cardType === allocation.cardType);
      const unitValue = card ? currentUnitValue(card, ipcRows) : 0;
      if (!card || unitValue <= 0) {
        throw new InvalidAllocationError(
          `El evento no tiene valor cargado para la tarjeta ${allocation.cardType} — cargalo con "Ajustar" antes de asignarle pagos`,
        );
      }
      const paidUnits = (paid.get(card.cardType)?.quantity ?? 0) + allocation.quantity;
      paid.set(card.cardType, { quantity: paidUnits, value: 0 });
      if (paidUnits > card.quantity) {
        await tx.eventCardAdjustment.create({
          data: {
            tenantId,
            cardId: card.id,
            previousQuantity: card.quantity,
            newQuantity: paidUnits,
            previousBaseValue: card.baseValue,
            newBaseValue: card.baseValue,
            previousBasePeriod: card.basePeriod,
            newBasePeriod: card.basePeriod,
            reason: 'Aumento automático de cantidad al asignar un pago',
            createdById: adminUserId,
          },
        });
        await tx.eventCard.update({ where: { id: card.id }, data: { quantity: paidUnits } });
        quantityRaises.push({ cardType: card.cardType, de: card.quantity, a: paidUnits });
        card.quantity = paidUnits;
      }
      allocationRows.push({
        cardType: allocation.cardType,
        quantity: allocation.quantity,
        unitValue,
      });
    }

    // Con las cantidades ya actualizadas: el aviso de tope de seña compara
    // contra el total que queda después de sumar las tarjetas nuevas.
    const { totalValue, totalPaid: paidBefore } = computeBeneficiaryFinancials(
      beneficiary,
      ipcRows,
      chargeableMinimum(beneficiary.event),
    );

    const row = await tx.payment.create({
      data: {
        tenantId,
        beneficiaryId,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        note: input.note ?? null,
        recordedById: adminUserId,
      },
    });

    if (allocationRows.length > 0) {
      await tx.paymentCardAllocation.createMany({
        data: allocationRows.map((allocation) => ({ tenantId, paymentId: row.id, ...allocation })),
      });
    }

    const config = await tx.tenantCostConfig.findUnique({ where: { tenantId } });
    const cap = config ? Number(config.advanceDepositCapPct) : 0.3;
    const advanceDepositWarning =
      totalValue > 0 && (paidBefore + Number(row.amount)) / totalValue > cap;

    const who = beneficiary.label ? ` de ${beneficiary.label}` : '';
    await audit(tx, tenantId, {
      entityType: 'Payment',
      entityId: row.id,
      eventId: beneficiary.eventId,
      action: 'CREATE',
      summary: `Pago de ${money(row.amount)}${who}`,
      changes: {
        monto: Number(row.amount),
        fecha: row.paymentDate.toISOString(),
        nota: row.note,
        tarjetas: allocationRows,
        ...(quantityRaises.length > 0 ? { cantidadAumentada: quantityRaises } : {}),
        avisoTopeSena: advanceDepositWarning,
      },
    });

    return {
      payment: serializePayment({ ...row, allocations: allocationRows }),
      advanceDepositWarning,
    };
  });
}

export async function deletePayment(tenantId: string, paymentId: string): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: true,
        beneficiary: { select: { label: true, eventId: true } },
      },
    });
    if (!payment || payment.tenantId !== tenantId) return;
    await tx.paymentCardAllocation.deleteMany({ where: { paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });
    // Antes de la Fase 4 borrar un pago no dejaba ningún rastro.
    const who = payment.beneficiary.label ? ` de ${payment.beneficiary.label}` : '';
    await audit(tx, tenantId, {
      entityType: 'Payment',
      entityId: paymentId,
      eventId: payment.beneficiary.eventId,
      action: 'DELETE',
      summary: `Baja del pago de ${money(payment.amount)}${who}`,
      changes: {
        monto: Number(payment.amount),
        fecha: payment.paymentDate.toISOString(),
        nota: payment.note,
        tarjetas: payment.allocations.map((a) => ({
          cardType: a.cardType,
          quantity: a.quantity,
          unitValue: Number(a.unitValue),
        })),
      },
    });
  });
}

/**
 * Vista imprimible para cuando un cliente pide el detalle de su cuenta —
 * Cami/Fede la abren desde el admin y se la muestran/mandan a mano (Ctrl+P),
 * no hay generación de PDF del lado del servidor por ahora.
 */
export async function getBeneficiaryReport(
  tenantId: string,
  beneficiaryId: string,
): Promise<BeneficiaryReport> {
  return withTenant(tenantId, async (tx) => {
    const beneficiary = await tx.eventBeneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        cards: true,
        payments: { include: { allocations: true }, orderBy: { paymentDate: 'desc' } },
        event: true,
      },
    });
    if (!beneficiary || beneficiary.tenantId !== tenantId) {
      throw new BeneficiaryNotFoundError();
    }

    const ipcRows = await tx.ipcIndexValue.findMany({
      where: { tenantId },
      orderBy: { period: 'asc' },
    });
    const financials = computeBeneficiaryFinancials(
      beneficiary,
      ipcRows,
      chargeableMinimum(beneficiary.event),
    );

    return {
      eventName: beneficiary.event.name,
      eventType: beneficiary.event.type,
      beneficiaryLabel: beneficiary.label,
      cards: financials.cards,
      minimumCharge: financials.minimumCharge,
      payments: beneficiary.payments.map(serializePayment),
      totalValue: financials.totalValue,
      totalPaid: financials.totalPaid,
      saldo: financials.saldo,
      percentPaid: financials.percentPaid,
      generatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Un mismo cliente puede tener 2+ eventos — antes había que ir evento por
 * evento para revisar su estado. Esto junta todo en un solo lugar (ver
 * CLAUDE.md "Fase 2 — vista de cliente").
 */
export async function listClients(tenantId: string): Promise<ClientListItem[]> {
  return withTenant(tenantId, async (tx) => {
    const users = await tx.user.findMany({
      where: { tenantId, role: 'CLIENTE' },
      include: { _count: { select: { eventAccounts: true } } },
      orderBy: { fullName: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      eventCount: user._count.eventAccounts,
    }));
  });
}

/**
 * Contraseña temporal para un CLIENTE que no puede entrar (decisión del
 * piloto: no hay email transaccional — sin "olvidé mi contraseña" — así que
 * la resetea el salón, mismo patrón que el acceso de puerta). Se devuelve UNA
 * vez, no se guarda en claro, y obliga a cambiarla al entrar. Solo clientes:
 * los admins se resetean con `tenant:bootstrap --reset-password` y los
 * empleados de puerta desde Personal. Queda en la auditoría (sin la clave).
 */
export async function resetClientPassword(
  tenantId: string,
  userId: string,
): Promise<{ email: string; temporaryPassword: string }> {
  return withTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId || user.role !== 'CLIENTE') {
      throw new ClientNotFoundError();
    }
    const temporaryPassword = generateTemporaryPassword();
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
    });
    await audit(tx, tenantId, {
      entityType: 'User',
      entityId: userId,
      action: 'UPDATE',
      summary: `Contraseña temporal generada para el cliente ${user.fullName} (${user.email})`,
    });
    return { email: user.email, temporaryPassword };
  });
}

export async function getClientDetail(tenantId: string, userId: string): Promise<ClientDetail> {
  return withTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId) {
      throw new ClientNotFoundError();
    }

    const [accounts, ipcRows] = await Promise.all([
      tx.eventAccount.findMany({
        where: { tenantId, userId },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
      }),
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
    ]);

    const events = await Promise.all(
      accounts.map(async (account) => {
        if (account.beneficiaryId) {
          const beneficiary = await tx.eventBeneficiary.findUniqueOrThrow({
            where: { id: account.beneficiaryId },
            include: { cards: true, payments: { include: { allocations: true } } },
          });
          const financials = computeBeneficiaryFinancials(
            beneficiary,
            ipcRows,
            chargeableMinimum(account.event),
          );
          return {
            eventAccountId: account.id,
            eventId: account.event.id,
            eventName: account.event.name,
            eventType: account.event.type,
            role: account.role,
            scope: 'own' as const,
            totalValue: financials.totalValue,
            totalPaid: financials.totalPaid,
            saldo: financials.saldo,
            percentPaid: financials.percentPaid,
          };
        }

        const beneficiaries = await tx.eventBeneficiary.findMany({
          where: { tenantId, eventId: account.eventId },
          include: { cards: true, payments: { include: { allocations: true } } },
        });
        const aggregate = computeAggregateFinancials(beneficiaries, ipcRows);
        return {
          eventAccountId: account.id,
          eventId: account.event.id,
          eventName: account.event.name,
          eventType: account.event.type,
          role: account.role,
          scope: 'aggregate' as const,
          totalValue: aggregate.totalValue,
          totalPaid: aggregate.totalPaid,
          saldo: aggregate.saldo,
          percentPaid: aggregate.percentPaid,
        };
      }),
    );

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      events,
    };
  });
}
