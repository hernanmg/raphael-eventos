import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../env';

// Fase 1: un solo tenant por deploy, resuelto por slug desde el env y
// cacheado en memoria. Cuando se sume un segundo tenant, esto pasa a
// resolverse por request (subdominio o header), no antes.
let cachedTenantId: string | null = null;

export async function tenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    if (!cachedTenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: env.TENANT_SLUG } });
      if (!tenant) {
        res.status(500).json({
          error: {
            message: `No existe un tenant con slug "${env.TENANT_SLUG}". Correr el seed: npm run db:seed -w apps/api.`,
          },
        });
        return;
      }
      cachedTenantId = tenant.id;
    }

    req.tenantId = cachedTenantId;
    next();
  } catch (err) {
    next(err);
  }
}
