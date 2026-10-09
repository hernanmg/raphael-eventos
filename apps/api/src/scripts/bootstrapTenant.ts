/**
 * Alta de un salón en una base NUEVA (producción) — NO es el seed de
 * desarrollo (`prisma/seed.ts`, que siembra usuarios/eventos demo).
 *
 * Crea/actualiza el tenant con su perfil público, los catálogos de costeo
 * (solo nombres de rubros, montos en 0 — los completa el salón) y las cuentas
 * de administrador. No crea eventos, empleados, proveedores ni datos de
 * prueba. Las contraseñas de admin son TEMPORALES, generadas en el momento
 * (nunca en el repo), se imprimen UNA vez y obligan a cambiarla en el primer
 * ingreso — mismo flujo que el acceso de puerta.
 *
 * Uso (desde apps/api, con DATABASE_URL = rol dueño de la base de destino):
 *   npm run tenant:bootstrap -- --config prisma/bootstrap/raphael-eventos.json \
 *     --admin "Fede Apellido <fede@ejemplo.com>" --admin "Cami Apellido <cami@ejemplo.com>"
 *
 * Idempotente: re-correrlo no duplica nada. Un admin que ya existe NO recibe
 * contraseña nueva (para resetearla: `--reset-password email`).
 *
 * Después: `npm run ipc:backfill` para traer la serie real de IPC.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { generateTemporaryPassword, hashPassword } from '../lib/password';

const ConfigSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  plan: z.enum(['BASICA', 'PRO']),
  publicProfile: z.object({
    whatsappNumber: z.string().regex(/^\d{8,15}$/, 'Solo dígitos, con código de país'),
    instagramUrl: z.string().url().nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
    mapsUrl: z.string().url().nullable().optional(),
  }),
  costing: z.object({
    supplyCategories: z.array(z.string().min(1)),
    serviceCostCategories: z.array(z.string().min(1)),
    fixedCostCategories: z.array(
      z.object({ name: z.string().min(1), guestScaled: z.boolean().optional() }),
    ),
  }),
});

function argValues(flag: string): string[] {
  const out: string[] = [];
  process.argv.forEach((arg, i) => {
    if (arg === flag && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  });
  return out;
}

/** "Nombre Apellido <email@x.com>" */
function parseAdmin(raw: string): { fullName: string; email: string } {
  const match = raw.match(/^\s*(.+?)\s*<\s*([^>\s]+@[^>\s]+)\s*>\s*$/);
  if (!match) throw new Error(`--admin inválido: "${raw}" (formato: "Nombre <email>")`);
  return { fullName: match[1]!, email: match[2]!.toLowerCase() };
}

async function main() {
  const configPath = argValues('--config')[0];
  if (!configPath) throw new Error('Falta --config <archivo.json>');
  const config = ConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf-8')));
  const admins = argValues('--admin').map(parseAdmin);
  const resets = new Set(argValues('--reset-password').map((e) => e.toLowerCase()));

  const ownerUrl = process.env.DATABASE_URL;
  if (!ownerUrl) throw new Error('Falta DATABASE_URL (rol dueño de la base de destino)');
  const prisma = new PrismaClient({ datasourceUrl: ownerUrl });

  try {
    // `tenants` no lleva RLS (app_user solo tiene SELECT): el alta va con el dueño.
    const tenant = await prisma.tenant.upsert({
      where: { slug: config.slug },
      update: { name: config.name, plan: config.plan, ...config.publicProfile },
      create: { slug: config.slug, name: config.name, plan: config.plan, ...config.publicProfile },
    });
    console.log(`Tenant: ${tenant.name} (${tenant.slug}) — plan ${tenant.plan}`);

    const credentials: { email: string; password: string }[] = [];

    // Todo lo de tenant con app.tenant_id seteado: funciona aunque el rol
    // dueño no tenga BYPASSRLS (las tablas tienen FORCE ROW LEVEL SECURITY).
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      const tenantId = tenant.id;

      await tx.tenantCostConfig.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          gananciaPct: 0.4,
          roturaPct: 0.15,
          ivaPct: 0.21,
          insumoRenegotiationPct: 0.1,
          advanceDepositCapPct: 0.3,
        },
      });

      let created = 0;
      for (const [index, name] of config.costing.supplyCategories.entries()) {
        const exists = await tx.supplyCategory.findFirst({ where: { tenantId, name } });
        if (!exists) {
          await tx.supplyCategory.create({ data: { tenantId, name, sortOrder: index } });
          created++;
        }
      }
      for (const name of config.costing.serviceCostCategories) {
        const exists = await tx.serviceCostCategory.findFirst({ where: { tenantId, name } });
        if (!exists) {
          await tx.serviceCostCategory.create({ data: { tenantId, name } });
          created++;
        }
      }
      for (const category of config.costing.fixedCostCategories) {
        const exists = await tx.fixedCostCategory.findFirst({
          where: { tenantId, name: category.name },
        });
        if (!exists) {
          // Monto 0: el valor real lo carga el salón ("celda amarilla").
          await tx.fixedCostCategory.create({
            data: {
              tenantId,
              name: category.name,
              monthlyAmount: 0,
              guestScaled: category.guestScaled ?? false,
            },
          });
          created++;
        }
      }
      console.log(`Catálogos de costeo: ${created} rubro(s) nuevo(s) (montos en 0).`);

      for (const admin of admins) {
        const existing = await tx.user.findUnique({
          where: { tenantId_email: { tenantId, email: admin.email } },
        });
        if (existing && !resets.has(admin.email)) {
          console.log(`Admin ${admin.email}: ya existe (sin cambios).`);
          continue;
        }
        const password = generateTemporaryPassword();
        const passwordHash = await hashPassword(password);
        if (existing) {
          await tx.user.update({
            where: { id: existing.id },
            data: { passwordHash, mustChangePassword: true },
          });
        } else {
          await tx.user.create({
            data: {
              tenantId,
              email: admin.email,
              fullName: admin.fullName,
              passwordHash,
              role: 'ADMIN',
              mustChangePassword: true,
            },
          });
        }
        credentials.push({ email: admin.email, password });
      }
    });

    if (credentials.length > 0) {
      console.log('\nContraseñas TEMPORALES (se muestran una sola vez; piden cambio al entrar):');
      for (const c of credentials) console.log(`  ${c.email}  →  ${c.password}`);
    }
    console.log('\nSiguiente paso: npm run ipc:backfill (serie real de IPC desde datos.gob.ar).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Bootstrap falló:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
