import type { ErrorRequestHandler } from 'express';

// Los errores de validación (Zod) se manejan en el punto de la request con
// parseBody (ver lib/validate.ts) — no acá, porque instanceof ZodError no es
// confiable cruzando el límite apps/api <-> packages/shared bajo el loader
// de Vitest. Este handler es el fallback genérico para todo lo demás.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { message: 'Error interno' } });
};
