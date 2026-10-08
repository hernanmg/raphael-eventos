import type {
  CalendarEntry,
  EventType,
  LeadIntakeInput,
  LeadStatus,
  LeadSummary,
  UpdateLeadInput,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  QUINCE: '15 años',
  EGRESO: 'Egresados',
  BODA: 'Boda',
  EMPRESARIAL: 'Empresarial',
};

function serializeLead(row: {
  id: string;
  fullName: string;
  phone: string;
  eventType: string;
  interestedDate: Date | null;
  message: string | null;
  status: string;
  notes: string | null;
  convertedEventId: string | null;
  createdAt: Date;
}): LeadSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    eventType: row.eventType as LeadSummary['eventType'],
    interestedDate: row.interestedDate?.toISOString() ?? null,
    message: row.message,
    status: row.status as LeadSummary['status'],
    notes: row.notes,
    convertedEventId: row.convertedEventId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Público, sin auth — lo llama el QuoteForm de la landing. */
export async function createLead(tenantId: string, input: LeadIntakeInput): Promise<LeadSummary> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.lead.create({
      data: {
        tenantId,
        fullName: input.fullName,
        phone: input.phone,
        eventType: input.eventType,
        interestedDate: input.interestedDate ? new Date(input.interestedDate) : null,
        message: input.message ?? null,
      },
    });
    return serializeLead(row);
  });
}

export async function listLeads(tenantId: string, status?: LeadStatus): Promise<LeadSummary[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.lead.findMany({
      where: { tenantId, status },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeLead);
  });
}

export async function updateLead(
  tenantId: string,
  id: string,
  input: UpdateLeadInput,
): Promise<LeadSummary> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.lead.update({
      where: { id },
      data: {
        status: input.status,
        notes: input.notes ?? null,
        interestedDate: input.interestedDate ? new Date(input.interestedDate) : null,
        convertedEventId: input.convertedEventId ?? null,
      },
    });
    return serializeLead(row);
  });
}

/**
 * Calendario de disponibilidad: eventos confirmados (por Event.eventDate) +
 * leads tentativos (Lead.interestedDate con status NUEVO/CONTACTADO/CON_SENA
 * — se excluyen GANADO/PERDIDO para no duplicar contra el Event real una vez
 * convertido, y para no mostrar fechas que ya se descartaron).
 */
export async function getCalendar(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<CalendarEntry[]> {
  return withTenant(tenantId, async (tx) => {
    const [events, leads] = await Promise.all([
      tx.event.findMany({
        // Fase 4: un evento CANCELADO libera la fecha (FINALIZADO sí la ocupó).
        where: { tenantId, eventDate: { gte: from, lt: to }, status: { not: 'CANCELADO' } },
        select: { id: true, name: true, type: true, eventDate: true },
      }),
      tx.lead.findMany({
        where: {
          tenantId,
          interestedDate: { gte: from, lt: to },
          status: { in: ['NUEVO', 'CONTACTADO', 'CON_SENA'] },
        },
        select: { id: true, fullName: true, eventType: true, interestedDate: true },
      }),
    ]);

    const confirmed: CalendarEntry[] = events.map((event) => ({
      date: event.eventDate!.toISOString(),
      kind: 'CONFIRMADO',
      eventType: event.type,
      label: event.name,
      refId: event.id,
    }));

    const tentative: CalendarEntry[] = leads.map((lead) => ({
      date: lead.interestedDate!.toISOString(),
      kind: 'TENTATIVO',
      eventType: lead.eventType,
      label: `${lead.fullName} (${EVENT_TYPE_LABELS[lead.eventType]})`,
      refId: lead.id,
    }));

    return [...confirmed, ...tentative].sort((a, b) => a.date.localeCompare(b.date));
  });
}
