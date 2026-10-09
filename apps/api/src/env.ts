import 'dotenv/config';
import { z } from 'zod';

// Variable opcional: "" (como queda en un dashboard de hosting al vaciarla)
// cuenta como no definida.
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),

    // Rol dueño de las tablas, usado SOLO por Prisma CLI (migrate), scripts de
    // administración (seed, tenant:bootstrap, ipc:backfill no lo necesita) y
    // la limpieza de tests. El servidor NUNCA lo usa para servir requests —
    // por eso es opcional: en producción el servicio web no tiene por qué
    // tener credenciales de dueño (se configura solo en el paso de migración).
    DATABASE_URL: optional(z.string().min(1)),

    // Rol restringido (sin BYPASSRLS, sin permisos de DDL) que usa el servidor
    // en runtime. Es el que hace que RLS realmente se aplique: si el server
    // corriera como el owner, Postgres lo dejaría bypassear las policies.
    APP_DATABASE_URL: z.string().min(1, 'APP_DATABASE_URL es obligatorio'),

    SESSION_SECRET: z.string().min(16, 'SESSION_SECRET debe tener al menos 16 caracteres'),

    // Fase 1 = un solo tenant por deploy. Se resuelve una vez al arrancar y se
    // cachea — todavía no hay resolución de tenant por subdominio/header por
    // request (eso es trabajo de la etapa de venta a otros salones).
    TENANT_SLUG: z.string().min(1).default('raphael-eventos'),

    // Origen(es) de la web para CORS, separados por coma si hay más de uno
    // (ej. "https://raphaeleventos.com,https://www.raphaeleventos.com").
    WEB_ORIGIN: z
      .string()
      .min(1)
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim().replace(/\/+$/, ''))
          .filter(Boolean),
      ),

    // Cantidad de proxies delante del server (Render pone 1; con el rewrite de Vercel delante son 2 — ver DEPLOY.md). Sin esto,
    // detrás de un proxy req.ip es la IP del proxy — todos los usuarios
    // compartirían un único contador de rate limit — y req.secure es false, así
    // que express-session no setea la cookie `secure` en producción. 0 en local.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Supabase Storage (contratos + logos de sponsors). Sin estas dos, se usa
    // disco local — válido SOLO en desarrollo (ver lib/storage.ts).
    SUPABASE_URL: optional(z.string().url()),
    SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(20)),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default('raphael-eventos'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Producción: fallar al arrancar antes que degradar en silencio.
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_URL'],
        message:
          'En producción SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias: el disco del host se pierde en cada redeploy',
      });
    }
    if (env.SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'En producción SESSION_SECRET tiene que tener al menos 32 caracteres aleatorios',
      });
    }
    if (env.TRUST_PROXY < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message:
          'En producción TRUST_PROXY tiene que ser >= 1 (detrás del proxy del host): sin eso la cookie secure no se setea y el rate limit trata a todos como una sola IP',
      });
    }
    if (env.WEB_ORIGIN.some((origin) => !origin.startsWith('https://'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEB_ORIGIN'],
        message: 'En producción WEB_ORIGIN tiene que ser https://',
      });
    }
  });

export const env = envSchema.parse(process.env);
