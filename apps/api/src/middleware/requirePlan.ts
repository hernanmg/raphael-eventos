import type { Request, Response, NextFunction } from 'express';
import type { Plan } from '@prisma/client';
import { prisma } from '../db/prisma';

/**
 * Calca requireRole.ts: el plan del tenant no viaja en la sesión (y puede
 * cambiar si el tenant hace upgrade), así que se consulta fresco en cada
 * request en vez de cachearlo — mismo criterio que ya se usa para el rol.
 * Va después de requireRole en la cadena de middlewares (necesita
 * req.tenantId, que ya pone tenantContext).
 */
export function requirePlan(...plans: Plan[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { plan: true },
      });
      if (!tenant || !plans.includes(tenant.plan)) {
        res.status(403).json({ error: { message: 'No disponible en el plan actual' } });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
