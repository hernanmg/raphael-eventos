/**
 * Limpieza de datos de test — ÚNICA para todos los archivos de test de la API.
 *
 * Contexto: los tests corren contra el MISMO Postgres y el MISMO tenant que
 * el seed (ver CLAUDE.md), así que la limpieza tiene que poder tocar SOLO
 * filas de test, nunca datos demo/reales. Antes cada archivo tenía su propia
 * lista de deleteMany en orden de dependencia, y se desactualizaba cada vez
 * que una fase agregaba una tabla colgando de Event (tarjetas, pagos,
 * invitados, check-in, ajustes...). Peor: auth.test.ts borraba
 * event/eventBeneficiary/eventAccount SIN FILTRO — si la FK de event_cards no
 * lo hubiera frenado, cada corrida habría borrado todos los eventos reales.
 *
 * Cómo funciona: lee las foreign keys del catálogo de Postgres y borra en
 * cascada desde las raíces de test (eventos y usuarios de test) — una tabla
 * nueva con FK a Event/EventBeneficiary/User/... queda cubierta sola, sin
 * tocar este archivo. Regla por columna:
 *   - FK NOT NULL → la fila hija "pertenece" a la fila de test: se borra.
 *   - FK nullable → es un vínculo opcional: se pone en NULL, la fila hija
 *     NO se borra (así un dato real que apunte a algo de test no se pierde).
 *
 * NO es un TRUNCATE ... CASCADE: TRUNCATE no acepta WHERE, vaciaría las
 * tablas enteras — incluidos los datos demo/reales del tenant.
 *
 * Qué es "de test" (convención de TODOS los fixtures):
 *   - emails @example.com (RFC 2606) — usuarios, titulares, contactos;
 *   - ids que empiezan con "test-";
 *   - IPC con período >= 2099 (los tests de IPC usan fechas futuras para no
 *     chocar con la serie real; si un test falla a mitad, esa fila quedaría
 *     como "último índice" y cambiaría todos los saldos reales).
 *
 * Corre con el rol dueño (DATABASE_URL): app_user no tiene DELETE en las
 * tablas append-only (audit_logs, event_card_adjustments), y Postgres chequea
 * el permiso aunque el DELETE no matchee ninguna fila.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { env } from '../env';

const TEST_EMAIL = '%@example.com';
const TEST_ID = 'test-%';
const TEST_IPC_FROM = '2099-01-01';

let ownerClient: PrismaClient | null = null;
function owner(): PrismaClient {
  ownerClient ??= new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  return ownerClient;
}

interface ForeignKey {
  child: string;
  childCol: string;
  parent: string;
  parentCol: string;
  nullable: boolean;
}

let fkCache: ForeignKey[] | null = null;

/** FKs de una sola columna del schema public (las únicas que usa Prisma acá). */
async function foreignKeys(tx: Prisma.TransactionClient): Promise<ForeignKey[]> {
  if (fkCache) return fkCache;
  fkCache = await tx.$queryRaw<ForeignKey[]>`
    SELECT cl.relname AS child, a.attname AS "childCol",
           pcl.relname AS parent, pa.attname AS "parentCol",
           NOT a.attnotnull AS nullable
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
    JOIN pg_class pcl ON pcl.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`;
  return fkCache;
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/**
 * Borra las filas de `table` que cumplen `where` (SQL con $1..$n), primero
 * resolviendo sus dependientes (borrar o poner en NULL, según la FK).
 */
async function purge(
  tx: Prisma.TransactionClient,
  table: string,
  where: string,
  params: unknown[],
  depth = 0,
): Promise<void> {
  if (depth > 20) throw new Error(`Cleanup de test: ciclo de FKs desde ${table}`);
  for (const fk of (await foreignKeys(tx)).filter((f) => f.parent === table)) {
    const childWhere = `${q(fk.childCol)} IN (SELECT ${q(fk.parentCol)} FROM ${q(table)} WHERE ${where})`;
    if (fk.nullable) {
      await tx.$executeRawUnsafe(
        `UPDATE ${q(fk.child)} SET ${q(fk.childCol)} = NULL WHERE ${childWhere}`,
        ...params,
      );
    } else {
      await purge(tx, fk.child, childWhere, params, depth + 1);
    }
  }
  await tx.$executeRawUnsafe(`DELETE FROM ${q(table)} WHERE ${where}`, ...params);
}

export interface CleanupOptions {
  /** Usuarios @example.com que el archivo necesita conservar entre tests (ej. su admin). */
  keepUserIds?: string[];
}

/** Borra TODO lo que sea de test (ver convención arriba) y nada más. */
export async function cleanupTestData(options: CleanupOptions = {}): Promise<void> {
  const keep = options.keepUserIds ?? [];
  await owner().$transaction(async (tx) => {
    // Primero se resuelven los ids: el criterio "evento con un alumno
    // @example.com" deja de matchear apenas se borran sus beneficiaries, a
    // mitad de la cascada — por id el DELETE final no depende del orden.
    const eventIds = (
      await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "events" WHERE "titularEmail" LIKE $1 OR "id" LIKE $2
         OR "id" IN (SELECT "eventId" FROM "event_beneficiaries" WHERE "contactEmail" LIKE $1)`,
        TEST_EMAIL,
        TEST_ID,
      )
    ).map((r) => r.id);
    const userIds = (
      await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "users" WHERE ("email" LIKE $1 OR "id" LIKE $2)
         AND NOT ("id" = ANY($3::text[]))`,
        TEST_EMAIL,
        TEST_ID,
        keep,
      )
    ).map((r) => r.id);

    if (eventIds.length > 0) {
      // Auditoría generada por eventos de test (sin FK a propósito: no la
      // alcanza el recorrido por FKs).
      await tx.$executeRawUnsafe(
        `DELETE FROM "audit_logs" WHERE "eventId" = ANY($1::text[])`,
        eventIds,
      );
      await purge(tx, 'events', `"id" = ANY($1::text[])`, [eventIds]);
    }
    if (userIds.length > 0) {
      await purge(tx, 'users', `"id" = ANY($1::text[])`, [userIds]);
    }
    // Auditoría de IPC de test (períodos >= 2099): no tiene eventId, y el test
    // de IPC borra su fila directamente, así que se identifica por el período.
    await tx.$executeRawUnsafe(
      `DELETE FROM "audit_logs" WHERE "entityType" = 'IpcIndexValue' AND "changes"->>'periodo' >= $1`,
      TEST_IPC_FROM,
    );
    await purge(tx, 'ipc_index_values', `("id" LIKE $1 OR "period" >= $2::timestamp)`, [
      TEST_ID,
      TEST_IPC_FROM,
    ]);
  });
}

export async function disconnectCleanup(): Promise<void> {
  await ownerClient?.$disconnect();
  ownerClient = null;
}
