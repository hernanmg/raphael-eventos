import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Toda lectura/escritura sobre una tabla con datos de tenant tiene que pasar
 * por acá. Setea `app.tenant_id` para la transacción actual vía
 * `set_config(..., is_local = true)`, que es lo que las policies de RLS leen
 * con `current_setting('app.tenant_id', true)`. Sin esto, como app_user no
 * tiene BYPASSRLS, cualquier query a esas tablas devuelve cero filas (o falla
 * el WITH CHECK en un insert/update).
 *
 * La tabla `tenants` es la única excepción: no tiene columna tenant_id (cada
 * fila ES un tenant) y no lleva RLS, así que resolverla no necesita pasar por
 * withTenant.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
