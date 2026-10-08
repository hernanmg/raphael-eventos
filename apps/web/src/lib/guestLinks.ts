import { ApiError } from './api';

/** Link público de invitación de un beneficiary (micrositio + RSVP). */
export function inviteUrl(inviteToken: string): string {
  return `${window.location.origin}/i/${inviteToken}`;
}

/** Link público de la entrada (QR) de un invitado. */
export function passUrl(qrToken: string): string {
  return `${window.location.origin}/q/${qrToken}`;
}

export function errorText(err: unknown, fallback = 'No pudimos guardar el cambio'): string {
  return err instanceof ApiError ? err.message : fallback;
}
