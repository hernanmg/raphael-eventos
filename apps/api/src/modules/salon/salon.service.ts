import type { SalonProfile } from '@raphael-eventos/shared';
import { prisma } from '../../db/prisma';

/**
 * Datos públicos del salón. `tenants` no lleva RLS (ver CLAUDE.md), no hace
 * falta pasar por withTenant — mismo criterio que getTenantPlan. Devuelve
 * solo campos pensados para mostrarse en público (nunca plan, slug, etc.).
 */
export async function getSalonProfile(tenantId: string): Promise<SalonProfile | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      whatsappNumber: true,
      instagramUrl: true,
      address: true,
      mapsUrl: true,
      contactEmail: true,
    },
  });
  return tenant;
}
