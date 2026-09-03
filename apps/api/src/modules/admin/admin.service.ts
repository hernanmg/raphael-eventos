import type {
  AdminEventDetail,
  CreateEventInput,
  CreateIpcEntryInput,
  DashboardSummary,
  IpcHistoryEntry,
} from '@raphael-eventos/shared';
import type { Prisma } from '@prisma/client';
import { withTenant } from '../../db/withTenant';
import { computeBeneficiaryFinancials } from '../../lib/financials';

export class EventNotFoundError extends Error {}

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
        include: { cards: true, payments: { orderBy: { paymentDate: 'desc' } } },
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
        payments: beneficiary.payments.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          paymentDate: payment.paymentDate.toISOString(),
          note: payment.note,
        })),
      };
    });
    totalValue = Number(totalValue.toFixed(2));
    totalPaid = Number(totalPaid.toFixed(2));

    return {
      id: event.id,
      type: event.type,
      name: event.name,
      eventDate: event.eventDate?.toISOString() ?? null,
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
 * Carga manual de un período de IPC — hasta que exista el job programado
 * contra datos.gob.ar (ver docs/costos/Arquitectura y costos.md), esta es la
 * única forma de cargar un nuevo valor. Mismo mecanismo que se documentó
 * para el job: la variación entre sourcePreviousValue/sourceLatestValue se
 * encadena sobre el último índice guardado (o arranca en 100 si es el primer
 * período que se carga para el tenant).
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
    const variation = input.sourceLatestValue / input.sourcePreviousValue;
    const indexValue = Number((baseIndex * variation).toFixed(6));

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
