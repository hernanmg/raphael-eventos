// Perfil público del salón (Fase 3) — lo leen la landing y el micrositio de
// invitados en vez de tener WhatsApp/Instagram/dirección hardcodeados.

export interface SalonProfile {
  name: string;
  /** Formato wa.me: solo dígitos con código de país (ej. 5493513180810). */
  whatsappNumber: string | null;
  instagramUrl: string | null;
  address: string | null;
  mapsUrl: string | null;
}
