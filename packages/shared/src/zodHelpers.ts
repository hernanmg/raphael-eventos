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
