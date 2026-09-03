import type { ZodType, ZodTypeDef } from 'zod';
import type { Response } from 'express';

/**
 * Valida `body` contra `schema` y responde 400 automáticamente si falla.
 * Devuelve `undefined` en ese caso — el caller solo tiene que cortar
 * (`if (!input) return;`).
 *
 * Se usa safeParse (no parse + catch) a propósito: en este monorepo,
 * `instanceof ZodError` no es confiable cuando el schema se definió en
 * packages/shared y el catch está en apps/api — bajo el loader de Vitest
 * terminan siendo dos instancias de la clase aunque resuelvan al mismo
 * archivo de node_modules/zod. safeParse evita depender de eso.
 *
 * La firma usa ZodType<T, ZodTypeDef, any> (no el alias ZodSchema<T>, que fija
 * Input = Output) a propósito: algún campo del schema puede tener un
 * preprocess/transform (ver RegisterSchema.phone en packages/shared), donde
 * el tipo de entrada difiere del de salida. Con ZodSchema<T> a secas,
 * TypeScript infería T desde el lado "input" (dejaba phone como `unknown`)
 * en vez del "output" (`string | undefined`) — bug real, no cosmético.
 */
export function parseBody<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentario arriba: Input debe quedar libre para que T se infiera del Output.
  schema: ZodType<T, ZodTypeDef, any>,
  body: unknown,
  res: Response,
): T | undefined {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: { message: 'Datos inválidos', issues: result.error.flatten() } });
    return undefined;
  }
  return result.data;
}
