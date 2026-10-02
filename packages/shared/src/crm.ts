// Schemas y tipos del CRM de consultas + calendario de disponibilidad —
// comparten el modelo Lead (ver CLAUDE.md "Fase 2 — CRM y calendario").

import { z } from 'zod';
import { EventTypeSchema, LeadStatusSchema } from './enums';
import { optionalText } from './zodHelpers';
import type { EventType, LeadStatus } from './enums';

/** Lo que manda el QuoteForm de la landing — público, sin auth. */
export const LeadIntakeSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá tu nombre').max(160),
  phone: z.string().trim().min(6, 'Ingresá tu WhatsApp').max(30),
  eventType: EventTypeSchema,
  interestedDate: optionalText(z.string().trim().min(1)),
  message: optionalText(z.string().trim().max(1000)),
});
export type LeadIntakeInput = z.infer<typeof LeadIntakeSchema>;

export const UpdateLeadSchema = z.object({
  status: LeadStatusSchema,
  notes: optionalText(z.string().trim().max(2000)),
  interestedDate: optionalText(z.string().trim().min(1)),
  convertedEventId: optionalText(z.string().trim().min(1)),
});
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

export interface LeadSummary {
  id: string;
  fullName: string;
  phone: string;
  eventType: EventType;
  interestedDate: string | null;
  message: string | null;
  status: LeadStatus;
  notes: string | null;
  convertedEventId: string | null;
  createdAt: string;
}

export interface CalendarEntry {
  date: string;
  kind: 'CONFIRMADO' | 'TENTATIVO';
  eventType: EventType;
  label: string;
  /** eventId si kind === 'CONFIRMADO', leadId si kind === 'TENTATIVO'. */
  refId: string;
}
