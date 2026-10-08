// Directorio de proveedores aliados + sponsors (Fase 4) — ver CLAUDE.md "Fase 4".

import { z } from 'zod';
import { EventTypeSchema } from './enums';
import type { EventType } from './enums';
import { formBoolean, httpUrl, optionalText } from './zodHelpers';

export const ProviderInputSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  category: z.string().trim().min(2, 'Ingresá el rubro').max(60),
  description: optionalText(z.string().trim().max(500)),
  contactName: optionalText(z.string().trim().max(120)),
  phone: optionalText(z.string().trim().min(6, 'Teléfono inválido').max(30)),
  email: optionalText(z.string().trim().toLowerCase().email('Email inválido')),
  instagramUrl: optionalText(httpUrl),
  websiteUrl: optionalText(httpUrl),
  eventTypes: z.array(EventTypeSchema).min(1, 'Elegí al menos un tipo de evento'),
  /** Solo referencia interna (no mueve dinero). */
  referralPct: optionalText(z.coerce.number().min(0).max(100)),
  referralNote: optionalText(z.string().trim().max(300)),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type ProviderInput = z.infer<typeof ProviderInputSchema>;

/** Lo que ve el público (landing/portal): sin comisión ni notas internas. */
export interface PublicProvider {
  id: string;
  name: string;
  category: string;
  description: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  eventTypes: EventType[];
}

/** Vista del panel: incluye la referencia de comisión (solo para Cami/Fede). */
export interface AdminProvider extends PublicProvider {
  referralPct: number | null;
  referralNote: string | null;
  active: boolean;
  sortOrder: number;
}

/** Campos de texto del form multipart de sponsor (el logo va como archivo aparte). */
export const SponsorInputSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  linkUrl: optionalText(httpUrl),
  active: formBoolean.default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type SponsorInput = z.infer<typeof SponsorInputSchema>;

export interface PublicSponsor {
  id: string;
  name: string;
  linkUrl: string | null;
  /** Ruta de la API que sirve el logo (relativa a la URL de la API). */
  logoPath: string;
}

export interface AdminSponsor extends PublicSponsor {
  active: boolean;
  sortOrder: number;
}
