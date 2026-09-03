import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Rol dueño de las tablas, usado SOLO por Prisma CLI (migrate/generate) y por
  // scripts de administración (seed). Tiene privilegios de DDL y, al no tener
  // el tenant seteado, las policies de RLS lo tratarían igual que a cualquier
  // otro rol — no se usa nunca para servir requests.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),

  // Rol restringido (sin BYPASSRLS, sin permisos de DDL) que usa el servidor
  // en runtime. Es el que hace que RLS realmente se aplique: si el server
  // corriera como el owner, Postgres lo dejaría bypassear las policies.
  APP_DATABASE_URL: z.string().min(1, 'APP_DATABASE_URL es obligatorio'),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET debe tener al menos 16 caracteres'),

  // Fase 1 = un solo tenant por deploy. Se resuelve una vez al arrancar y se
  // cachea — todavía no hay resolución de tenant por subdominio/header por
  // request (eso es trabajo de la etapa de venta a otros salones).
  TENANT_SLUG: z.string().min(1).default('raphael-eventos'),

  WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
