import { z } from 'zod';

/**
 * Un <input> opcional sin tocar manda "" (string vacío), no undefined — y
 * `.optional()` de Zod no acepta string vacío como "no cargado". Sin esto,
 * un campo opcional en blanco rompe la validación (bug real: ver
 * RegisterSchema.phone). Envolver así cualquier campo opcional de texto en
 * un form.
 */
export function optionalText<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/**
 * Link que termina en un href público: SOLO http(s). `z.string().url()` a
 * secas acepta cualquier esquema que parsee `new URL()` (incluido
 * `javascript:`).
 */
export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url('Link inválido')
  .refine((v) => /^https?:\/\//i.test(v), 'El link tiene que empezar con http:// o https://');

/**
 * Booleano que puede llegar como string (campos de un form multipart:
 * "true"/"false"). `z.coerce.boolean()` daría true para "false".
 */
export const formBoolean = z.preprocess(
  (value) => (typeof value === 'string' ? value === 'true' : value),
  z.boolean(),
);
