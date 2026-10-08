// Schemas y tipos del módulo de invitados + check-in (Fase 3) — ver
// CLAUDE.md "Fase 3 — Invitados".

import { z } from 'zod';
import type { EventType } from './enums';
import type { SalonProfile } from './salon';
import { optionalText } from './zodHelpers';

/** Confirmación de asistencia desde el link de invitación (público, sin cuenta). */
export const GuestRsvpSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá tu nombre y apellido').max(120),
  phone: optionalText(z.string().trim().min(6, 'Teléfono inválido').max(30)),
  email: optionalText(z.string().trim().toLowerCase().email('Email inválido').max(160)),
});
export type GuestRsvpInput = z.infer<typeof GuestRsvpSchema>;

/** Carga de un invitado por el titular (portal) — sin el cierre de N días del link. */
export const GuestInputSchema = GuestRsvpSchema.extend({
  /** "Entrada después de las 12": mismo QR, etiqueta visible en la puerta. */
  lateEntry: z.boolean().default(false),
});
export type GuestInput = z.infer<typeof GuestInputSchema>;

/** Carga por el admin: puede elegir a qué familia/alumno pertenece (egreso). */
export const AdminGuestInputSchema = GuestInputSchema.extend({
  beneficiaryId: optionalText(z.string().trim().min(1)),
});
export type AdminGuestInput = z.infer<typeof AdminGuestInputSchema>;

// Solo http(s): `z.string().url()` acepta cualquier esquema que parsee
// `new URL()` (incluido `javascript:`), y esto termina en un href público.
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url('Link inválido')
  .refine((v) => /^https?:\/\//i.test(v), 'El link tiene que empezar con http:// o https://');

/** Datos del micrositio que carga el admin: hora de inicio y link de fotos. */
export const EventPublicInfoSchema = z.object({
  startTime: optionalText(
    z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (formato HH:mm)'),
  ),
  photosUrl: optionalText(httpUrl),
});
export type EventPublicInfoInput = z.infer<typeof EventPublicInfoSchema>;

export type GuestStatus = 'CONFIRMADO' | 'CANCELADO';
export type GuestSource = 'AUTOGESTION' | 'TITULAR' | 'ADMIN';

export interface GuestSummary {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: GuestStatus;
  source: GuestSource;
  lateEntry: boolean;
  entryCode: string;
  /** Para armar el link de su entrada (`/q/:qrToken`) y reenviársela. */
  qrToken: string;
  beneficiaryId: string | null;
  beneficiaryLabel: string | null;
  confirmedAt: string;
}

/**
 * Avance de confirmados del evento entero, en runtime (sin contador
 * persistido). `target` = `Event.minGuests`, o la suma de tarjetas cuando es
 * null (QUINCE/BODA/EMPRESARIAL) — mismo default que el costeo.
 */
export interface GuestAttendance {
  confirmed: number;
  target: number | null;
  targetSource: 'MIN_GUESTS' | 'CARDS' | null;
}

/** GET /portal/events/:eventId/guests */
export interface PortalGuestsView {
  /** false para el titular de un egreso (ve solo el avance, no listas de otras familias). */
  canManage: boolean;
  inviteToken: string | null;
  guests: GuestSummary[];
  attendance: GuestAttendance;
}

/** GET /admin/events/:eventId/guests */
export interface AdminGuestsView {
  beneficiaries: { id: string; label: string | null; inviteToken: string | null }[];
  guests: GuestSummary[];
  attendance: GuestAttendance;
}

/** Datos públicos del evento para el micrositio — nunca financieros ni del titular. */
export interface PublicEventInfo {
  name: string;
  type: EventType;
  eventDate: string | null;
  /** "HH:mm", hora local del salón. */
  startTime: string | null;
  photosUrl: string | null;
}

/** GET /public/invite/:inviteToken — micrositio + estado del RSVP. */
export interface InviteView {
  event: PublicEventInfo;
  salon: SalonProfile;
  /** En egreso, el alumno que invita (el link es de esa familia); null en el resto. */
  invitedBy: string | null;
  rsvpOpen: boolean;
  /** Último momento para confirmar por link (ISO), null si el evento no tiene fecha. */
  rsvpClosesAt: string | null;
}

/** GET /public/guest/:qrToken — la "entrada" del invitado con su QR. */
export interface GuestPassView {
  fullName: string;
  status: GuestStatus;
  lateEntry: boolean;
  entryCode: string;
  qrToken: string;
  event: PublicEventInfo;
  salon: SalonProfile;
}

// -- Check-in en la puerta ---------------------------------------------

/**
 * Búsqueda de solo lectura (no registra nada): por el contenido del QR (la
 * URL de la entrada o el token suelto), por código corto, o por nombre como
 * último recurso. Reintentar una lectura nunca cuenta como duplicado.
 */
export const CheckInLookupSchema = z
  .object({
    qr: optionalText(z.string().trim().max(500)),
    code: optionalText(z.string().trim().toUpperCase().max(12)),
    query: optionalText(z.string().trim().min(2, 'Escribí al menos 2 letras').max(80)),
  })
  .refine((v) => Boolean(v.qr || v.code || v.query), {
    message: 'Escaneá un QR, ingresá un código o buscá por nombre',
  });
export type CheckInLookupInput = z.infer<typeof CheckInLookupSchema>;

/**
 * Admitir. `note` es obligatoria (lo valida el backend) cuando el invitado
 * ya tenía un ingreso ADMITIDO: reingreso con verificación manual.
 */
export const CheckInAdmitSchema = z.object({
  note: optionalText(z.string().trim().max(300)),
});
export type CheckInAdmitInput = z.infer<typeof CheckInAdmitSchema>;

export const CheckInRejectSchema = z.object({
  note: optionalText(z.string().trim().max(300)),
});
export type CheckInRejectInput = z.infer<typeof CheckInRejectSchema>;

export interface CheckInGuestView {
  guestId: string;
  fullName: string;
  status: GuestStatus;
  lateEntry: boolean;
  entryCode: string;
  beneficiaryLabel: string | null;
  /** Último ingreso ADMITIDO (ISO) — si existe, admitir de nuevo es un reingreso. */
  lastAdmittedAt: string | null;
  admittedCount: number;
}

export interface CheckInEventView {
  id: string;
  name: string;
  type: EventType;
  eventDate: string | null;
  startTime: string | null;
  confirmed: number;
  /** Invitados distintos con al menos un ingreso ADMITIDO. */
  admitted: number;
}

/** Evento disponible en la pantalla de check-in de la puerta. */
export interface CheckInEventSummary {
  id: string;
  name: string;
  type: EventType;
  eventDate: string | null;
  startTime: string | null;
}
