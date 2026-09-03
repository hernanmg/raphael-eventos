// Schemas de validación de auth, compartidos entre apps/web (formularios) y
// apps/api (validación de payloads) — misma fuente de verdad para ambos.

import { z } from 'zod';
import { RoleSchema } from './enums';
import { optionalText } from './zodHelpers';

export const RegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá tu nombre completo').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  phone: optionalText(z.string().trim().min(6).max(30)),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: RoleSchema,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
