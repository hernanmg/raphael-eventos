import type { ErrorRequestHandler } from 'express';

// Los errores de validación (Zod) se manejan en el punto de la request con
// parseBody (ver lib/validate.ts) — no acá, porque instanceof ZodError no es
// confiable cruzando el límite apps/api <-> packages/shared bajo el loader
// de Vitest. Este handler es el fallback genérico para todo lo demás.
//
// Errores conocidos de Prisma: antes caían todos en un 500 "Error interno"
// y la pantalla no tenía nada útil que mostrar (bug real en costeo: agregar
// un rubro con un nombre ya existente "no hacía nada"). Se detectan por
// `name`/`code` y no por instanceof, mismo criterio que con ZodError.
const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: 'Ya existe un registro con ese nombre' },
  P2003: {
    status: 409,
    message: 'No se puede borrar: está en uso en otros datos cargados',
  },
  P2025: { status: 404, message: 'No encontramos ese registro' },
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (
    err?.name === 'PrismaClientKnownRequestError' &&
    typeof err.code === 'string' &&
    PRISMA_ERRORS[err.code]
  ) {
    const { status, message } = PRISMA_ERRORS[err.code]!;
    res.status(status).json({ error: { message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Error interno' } });
};
