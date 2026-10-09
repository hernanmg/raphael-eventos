import type {
  AdminEventDetail,
  BeneficiaryReport,
  ClientDetail,
  ClientListItem,
  CardAdjustmentInput,
  CreateEventInput,
  CreateIpcEntryInput,
  DashboardSummary,
  IpcHistoryEntry,
  RecordPaymentInput,
  RecordPaymentResult,
  UpdateEventInput,
} from '@raphael-eventos/shared';
import type { Prisma } from '@prisma/client';
import { withTenant } from '../../db/withTenant';
import { audit, diffFields, money, snapshot } from '../../lib/audit';
import { generateTemporaryPassword, hashPassword } from '../../lib/password';
import {
  computeAggregateFinancials,
  computeBeneficiaryFinancials,
  serializePayment,
} from '../../lib/financials';

export class EventNotFoundError extends Error {}
export class BeneficiaryNotFoundError extends Error {}
export class InvalidAllocationError extends Error {}
export class ClientNotFoundError extends Error {}
export class CardNotFoundError extends Error {}
export class InvalidCardAdjustmentError extends Error {}

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
  for (const card of cards) {
    if (card.quantity <= 0) continue;
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
        minGuests: input.type === 'EGRESO' ? (input.minGuests ?? null) : null,
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
          .filter((card) => card.quantity > 0)
          .map((card) => ({
            tipo: card.cardType,
            cantidad: card.quantity,
            valorBase: card.baseValue,
          })),
        ...(input.type === 'EGRESO' ? { alumnos: input.alumnos.length } : {}),
      },
    });

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

    const data = {
      name: input.name,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      titularName: input.titularName ?? null,
      titularEmail: input.titularEmail,
      titularPhone: input.titularPhone ?? null,
      minGuests: before.type === 'EGRESO' ? (input.minGuests ?? null) : null,
      status: input.status,
    };
    const changes = diffFields(before, data, [
      'name',
      'eventDate',
      'titularName',
      'titularEmail',
      'titularPhone',
      'minGuests',
      'status',
    ]);
    if (!changes) return before;

    const event = await tx.event.update({ where: { id: eventId }, data });

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
    const event = await tx.event.findUnique({ where: { id: eventId } });
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
    const beneficiaryDetails = beneficiaries.map((beneficiary) => {
      const financials = computeBeneficiaryFinancials(beneficiary, ipcRows);
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
 * `sourcePreviousValue`/`sourceLatestValue` son puntos porcentuales de
 * variación intermensual (el mismo dato que devuelve la serie de datos.gob.ar
 * — ej. 2.11 significa +2.11% ese mes), **no niveles de índice**. Único el
 * último valor participa del cálculo — el anterior queda solo de referencia/
 * auditoría (para poder cotejar contra lo que ya se había cargado el mes
 * pasado). El encadenamiento es `índice_nuevo = índice_anterior × (1 +
 * variación/100)`, arrancando en 100 si es el primer período del tenant.
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

    const lastRow = await tx.ipcIndexValue.findFirst({
      where: { tenantId },
      orderBy: { period: 'desc' },
    });
    const baseIndex = lastRow ? Number(lastRow.indexValue) : 100;
    const indexValue = Number((baseIndex * (1 + input.sourceLatestValue / 100)).toFixed(6));

    const row = await tx.ipcIndexValue.upsert({
      where: { tenantId_period: { tenantId, period } },
      update: {
        indexValue,
        sourcePreviousValue: input.sourcePreviousValue,
        sourceLatestValue: input.sourceLatestValue,
        triggeredById: adminUserId,
        fetchedAt: new Date(),
      },
      create: {
        tenantId,
        period,
        indexValue,
        sourcePreviousValue: input.sourcePreviousValue,
        sourceLatestValue: input.sourceLatestValue,
        triggeredById: adminUserId,
      },
      include: { triggeredBy: { select: { fullName: true } } },
    });

    await audit(tx, tenantId, {
      entityType: 'IpcIndexValue',
      entityId: row.id,
      action: 'CREATE',
      summary: `IPC cargado a mano para ${period.toISOString().slice(0, 7)}: +${input.sourceLatestValue}%`,
      changes: {
        periodo: period.toISOString(),
        variacionPct: input.sourceLatestValue,
        variacionAnteriorPct: input.sourcePreviousValue,
        indiceAnterior: baseIndex,
        indiceResultante: indexValue,
        origen: 'MANUAL',
      },
    });

    return {
      id: row.id,
      period: row.period.toISOString(),
      indexValue: Number(row.indexValue),
      sourcePreviousValue: Number(row.sourcePreviousValue),
      sourceLatestValue: Number(row.sourceLatestValue),
      fetchedAt: row.fetchedAt.toISOString(),
      triggeredByName: row.triggeredBy?.fullName ?? null,
    };
  });
}

/**
 * Alta de un pago — todo se cobra en persona (efectivo/transferencia), el
 * cliente nunca carga esto: siempre es Cami o Fede desde el panel admin, acá
 * es donde faltaba el endpoint (Fase 1 solo tenía lectura de `payments`, no
 * alta — hueco real encontrado probando la app).
 *
 * `input.allocations` es opcional (ver CLAUDE.md "Fase 2 — asignación de
 * pagos"): si viene, cada línea se valida contra lo que falta pagar de ese
 * tipo de tarjeta (cantidad total menos lo ya asignado en pagos previos) —
 * no deja marcar como pagas más unidades de las que existen.
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
      include: { cards: true, payments: { include: { allocations: true } } },
    });
    if (!beneficiary || beneficiary.tenantId !== tenantId) {
      throw new BeneficiaryNotFoundError();
    }

    if (input.allocations.length > 0) {
      const remainingByType = new Map(
        beneficiary.cards.map((card) => [card.cardType, card.quantity]),
      );
      for (const payment of beneficiary.payments) {
        for (const allocation of payment.allocations) {
          remainingByType.set(
            allocation.cardType,
            (remainingByType.get(allocation.cardType) ?? 0) - allocation.quantity,
          );
        }
      }
      for (const allocation of input.allocations) {
        const remaining = remainingByType.get(allocation.cardType) ?? 0;
        if (allocation.quantity > remaining) {
          throw new InvalidAllocationError(
            `Ya están pagas o no existen esa cantidad de tarjetas ${allocation.cardType} — quedan ${Math.max(remaining, 0)} sin asignar`,
          );
        }
        remainingByType.set(allocation.cardType, remaining - allocation.quantity);
      }
    }

    const ipcRows = await tx.ipcIndexValue.findMany({
      where: { tenantId },
      orderBy: { period: 'asc' },
    });
    const { totalValue, totalPaid: paidBefore } = computeBeneficiaryFinancials(
      beneficiary,
      ipcRows,
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

    if (input.allocations.length > 0) {
      await tx.paymentCardAllocation.createMany({
        data: input.allocations.map((allocation) => ({
          tenantId,
          paymentId: row.id,
          cardType: allocation.cardType,
          quantity: allocation.quantity,
        })),
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
        tarjetas: input.allocations,
        avisoTopeSena: advanceDepositWarning,
      },
    });

    return {
      payment: serializePayment({
        ...row,
        allocations: input.allocations,
      }),
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
        tarjetas: payment.allocations.map((a) => ({ cardType: a.cardType, quantity: a.quantity })),
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
    const financials = computeBeneficiaryFinancials(beneficiary, ipcRows);

    return {
      eventName: beneficiary.event.name,
      eventType: beneficiary.event.type,
      beneficiaryLabel: beneficiary.label,
      cards: financials.cards,
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
          const financials = computeBeneficiaryFinancials(beneficiary, ipcRows);
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
