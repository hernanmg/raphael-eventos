import { PrismaClient } from '@prisma/client';
import { env } from '../env';

// Conecta siempre como app_user (APP_DATABASE_URL), nunca como el owner —
// ver env.ts y withTenant.ts para el porqué.
export const prisma = new PrismaClient({
  datasourceUrl: env.APP_DATABASE_URL,
});
