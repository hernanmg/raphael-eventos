import type { EventDetail, EventSummary } from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { computeAggregateFinancials, computeBeneficiaryFinancials } from '../../lib/financials';

export class EventNotAccessibleError extends Error {}

export async function listUserEvents(tenantId: string, userId: string): Promise<EventSummary[]> {
  return withTenant(tenantId, async (tx) => {
    const [links, ipcRows] = await Promise.all([
      tx.eventAccount.findMany({
        where: { tenantId, userId },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
      }),
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
    ]);

    const summaries: EventSummary[] = [];

    for (const link of links) {
      const base = {
        eventId: link.event.id,
        type: link.event.type,
        name: link.event.name,
        eventDate: link.event.eventDate?.toISOString() ?? null,
        status: link.event.status,
        role: link.role,
        minGuests: link.event.minGuests,
      };

      if (link.beneficiaryId) {
        const beneficiary = await tx.eventBeneficiary.findUniqueOrThrow({
          where: { id: link.beneficiaryId },
          include: { cards: true, payments: true },
        });
        // El listado es un resumen — el desglose de tarjetas (`cards`) va
        // solo en el detalle (getUserEventDetail), por eso se descarta acá
        // explícitamente en vez de spreadear computeBeneficiaryFinancials()
        // entero (eso filtró `cards` al payload del listado en la práctica:
        // TS no marca "excess property" en propiedades que vienen de un
        // spread, así que el tipo EventSummary no lo agarró).
        const { cards: _cards, ...totals } = computeBeneficiaryFinancials(beneficiary, ipcRows);
        summaries.push({ ...base, scope: 'own', ...totals });
        continue;
      }

      // Titular de EGRESO: agregado de todos los beneficiaries del evento,
      // nunca el detalle de cada familia (ver EventAccount en el schema).
      const beneficiaries = await tx.eventBeneficiary.findMany({
        where: { tenantId, eventId: link.eventId },
        include: { cards: true, payments: true },
      });
      const aggregate = computeAggregateFinancials(beneficiaries, ipcRows);
      summaries.push({ ...base, scope: 'aggregate', ...aggregate });
    }

    return summaries;
  });
}

export async function getUserEventDetail(
  tenantId: string,
  userId: string,
  eventId: string,
): Promise<EventDetail> {
  return withTenant(tenantId, async (tx) => {
    const link = await tx.eventAccount.findUnique({
      where: { eventId_userId: { eventId, userId } },
      include: { event: true },
    });
    if (!link) {
      throw new EventNotAccessibleError();
    }

    const ipcRows = await tx.ipcIndexValue.findMany({
      where: { tenantId },
      orderBy: { period: 'asc' },
    });

    const base = {
      eventId: link.event.id,
      type: link.event.type,
      name: link.event.name,
      eventDate: link.event.eventDate?.toISOString() ?? null,
      status: link.event.status,
      role: link.role,
      minGuests: link.event.minGuests,
    };

    if (link.beneficiaryId) {
      const beneficiary = await tx.eventBeneficiary.findUniqueOrThrow({
        where: { id: link.beneficiaryId },
        include: { cards: true, payments: { orderBy: { paymentDate: 'desc' } } },
      });
      const financials = computeBeneficiaryFinancials(beneficiary, ipcRows);

      return {
        ...base,
        scope: 'own',
        own: {
          label: beneficiary.label,
          ...financials,
          payments: beneficiary.payments.map((payment) => ({
            id: payment.id,
            amount: Number(payment.amount),
            paymentDate: payment.paymentDate.toISOString(),
            note: payment.note,
          })),
        },
      };
    }

    const beneficiaries = await tx.eventBeneficiary.findMany({
      where: { tenantId, eventId: link.eventId },
      include: { cards: true, payments: true },
    });

    return {
      ...base,
      scope: 'aggregate',
      aggregate: computeAggregateFinancials(beneficiaries, ipcRows),
    };
  });
}
