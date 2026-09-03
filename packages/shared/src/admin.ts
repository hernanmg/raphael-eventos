// Schemas y tipos del panel admin — alta de eventos y carga de IPC. Los
// schemas de input se comparten (validación de formulario en apps/web +
// validación de payload en apps/api); los tipos de respuesta son interfaces
// planas, igual criterio que portal.ts (el backend genera esos datos él
// mismo, no hay input de usuario que validar ahí).

import { z } from 'zod';
import { CardTypeSchema, EventTypeSchema } from './enums';
import { optionalText } from './zodHelpers';
import type { EventStatus, EventType } from './enums';
import type { CardSummary, PaymentSummary } from './portal';

export const EventCardInputSchema = z.object({
  cardType: CardTypeSchema,
  quantity: z.coerce.number().int().min(0).max(9999),
  baseValue: z.coerce.number().min(0).max(100_000_000),
});
export type EventCardInput = z.infer<typeof EventCardInputSchema>;

export const AlumnoInputSchema = z.object({
  label: z.string().trim().min(1, 'Ingresá el nombre del alumno').max(160),
  contactEmail: optionalText(z.string().trim().toLowerCase().email('Email inválido')),
});
export type AlumnoInput = z.infer<typeof AlumnoInputSchema>;

/**
 * Alta de evento. `cards` son las 4 tarjetas (algunas en 0 si no aplican al
 * evento). En EGRESO, `cards` es la plantilla que se aplica igual a cada
 * alumno de `alumnos` (simplificación de la Fase 1 — todos los alumnos de un
 * mismo egreso comparten el mismo desglose; ajustar valores por alumno
 * individual queda para más adelante).
 */
export const CreateEventSchema = z
  .object({
    type: EventTypeSchema,
    name: z.string().trim().min(2, 'Ingresá un nombre para el evento').max(160),
    eventDate: optionalText(z.string().trim().min(1)),
    titularName: optionalText(z.string().trim().min(2).max(160)),
    titularEmail: z.string().trim().toLowerCase().email('Email inválido'),
    // optionalText (no z.coerce.number().optional() a secas): un <input
    // type="number"> vacío llega como "", y Number("") da 0 en vez de NaN —
    // sin esto, dejar el campo en blanco guardaba minGuests: 0 en lugar de
    // "no cargado". Mismo bug de fondo que ya se dio con RegisterSchema.phone.
    minGuests: optionalText(z.coerce.number().int().min(0).max(100_000)),
    cards: z.array(EventCardInputSchema).length(4),
    alumnos: z.array(AlumnoInputSchema).default([]),
  })
  .refine((data) => data.cards.some((card) => card.quantity > 0), {
    message: 'Cargá una cantidad mayor a 0 en al menos un tipo de tarjeta',
    path: ['cards'],
  })
  .refine((data) => data.type !== 'EGRESO' || data.alumnos.length > 0, {
    message: 'Un egreso necesita al menos un alumno cargado',
    path: ['alumnos'],
  });
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const CreateIpcEntrySchema = z.object({
  /** Mes que representa el dato (primer día de mes, ej. "2026-09-01"). */
  period: z.string().trim().min(1, 'Elegí el período'),
  sourcePreviousValue: z.coerce.number().positive('Tiene que ser mayor a 0'),
  sourceLatestValue: z.coerce.number().positive('Tiene que ser mayor a 0'),
});
export type CreateIpcEntryInput = z.infer<typeof CreateIpcEntrySchema>;

export interface AdminEventListItem {
  id: string;
  name: string;
  type: EventType;
  eventDate: string | null;
  status: EventStatus;
}

export interface DashboardSummary {
  totals: {
    total: number;
    QUINCE: number;
    EGRESO: number;
    BODA: number;
    EMPRESARIAL: number;
  };
  /** Todos los eventos del tenant (no solo los próximos) — el frontend arma
   *  la vista "Próximos eventos" y el filtro por tarjeta a partir de esto. */
  events: AdminEventListItem[];
}

export interface AdminBeneficiaryDetail {
  id: string;
  /** Nombre del alumno en EGRESO; null en el resto (el beneficiary es el evento). */
  label: string | null;
  contactEmail: string | null;
  /** true si ya hay una cuenta de cliente vinculada a este beneficiary. */
  linked: boolean;
  cards: CardSummary[];
  payments: PaymentSummary[];
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
}

/**
 * Vista admin de un evento — a diferencia de EventDetail (portal), no aplica
 * la restricción de privacidad titular-de-egreso: el staff ve el desglose de
 * TODOS los beneficiaries, incluso en un egreso con varios alumnos.
 */
export interface AdminEventDetail {
  id: string;
  type: EventType;
  name: string;
  eventDate: string | null;
  status: EventStatus;
  titularName: string | null;
  titularEmail: string | null;
  minGuests: number | null;
  beneficiaries: AdminBeneficiaryDetail[];
  totals: {
    totalValue: number;
    totalPaid: number;
    saldo: number;
    percentPaid: number;
  };
}

export interface IpcHistoryEntry {
  id: string;
  period: string;
  indexValue: number;
  sourcePreviousValue: number;
  sourceLatestValue: number;
  fetchedAt: string;
  triggeredByName: string | null;
}
