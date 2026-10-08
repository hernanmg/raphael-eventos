import type {
  AdminEventDetail,
  BeneficiaryReport,
  ClientDetail,
  ClientListItem,
  CreateEventInput,
  CreateIpcEntryInput,
  DashboardSummary,
  IpcHistoryEntry,
  RecordPaymentInput,
  RecordPaymentResult,
} from '@raphael-eventos/shared';
import type { Prisma } from '@prisma/client';
import { withTenant } from '../../db/withTenant';
import {
  computeAggregateFinancials,
  computeBeneficiaryFinancials,
  serializePayment,
} from '../../lib/financials';

export class EventNotFoundError extends Error {}
export class BeneficiaryNotFoundError extends Error {}
export class InvalidAllocationError extends Error {}
export class ClientNotFoundError extends Error {}

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

    return event;
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
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.tenantId !== tenantId) return;
    await tx.paymentCardAllocation.deleteMany({ where: { paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });
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
