import type { IpcStalenessStatus } from '@raphael-eventos/shared';
import { prisma } from '../db/prisma';
import { withTenant } from '../db/withTenant';
import { audit } from './audit';
import { SYSTEM_ACTOR, runWithActor } from './requestContext';

const SERIES_URL =
  'https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=2&sort=desc';

interface DatosGobArResponse {
  data: [string, number][];
}

interface FetchedIpcPeriod {
  period: Date;
  /** Puntos porcentuales (la API devuelve fracción, ej. 0.0211 -> 2.11). */
  latestValuePct: number;
  previousValuePct: number;
}

const SERIES_ID = '145.3_INGNACUAL_DICI_M_38';

export interface IpcSeriesPoint {
  /** Primer día del mes (UTC). */
  period: Date;
  /** Variación intermensual en puntos porcentuales (la API da fracción: 0.0211 -> 2.11). */
  valuePct: number;
}

/**
 * Serie histórica de variación intermensual desde `startDate` (YYYY-MM-DD),
 * en orden ascendente. Solo la usa el backfill único
 * (src/scripts/backfillIpc.ts) — mismo dato y misma conversión que
 * fetchLatestIpcPeriod. Tira error si la API falla: un script manual tiene
 * que fallar en voz alta, no en silencio como el cron.
 */
export async function fetchIpcSeries(startDate: string): Promise<IpcSeriesPoint[]> {
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${SERIES_ID}&start_date=${startDate}&limit=1000&sort=asc`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`datos.gob.ar respondió ${res.status}`);
    const body = (await res.json()) as DatosGobArResponse;
    return (body.data ?? []).map(([date, fraction]) => ({
      period: new Date(`${date}T00:00:00.000Z`),
      valuePct: fraction * 100,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Llama a la API real de datos.gob.ar. Nunca la llama una pantalla de
 * cliente/admin — solo el job programado (ver runIpcAutoFetch más abajo),
 * que es el único lugar donde una falla acá es aceptable: si esto tira error
 * o timeoutea, el caller simplemente no escribe nada nuevo y todo sigue
 * leyendo el último IpcIndexValue ya guardado (ver indexFactor() en
 * lib/financials.ts) — nunca se propaga a una request de usuario.
 */
async function fetchLatestIpcPeriod(): Promise<FetchedIpcPeriod | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(SERIES_URL, { signal: controller.signal });
    if (!res.ok) return null;

    const body = (await res.json()) as DatosGobArResponse;
    if (!body.data || body.data.length < 2) return null;

    const [latestRow, previousRow] = body.data;
    if (!latestRow || !previousRow) return null;

    return {
      period: new Date(`${latestRow[0]}T00:00:00.000Z`),
      latestValuePct: latestRow[1] * 100,
      previousValuePct: previousRow[1] * 100,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Corre para un tenant: si la API tiene un período más nuevo que el último
 * guardado, lo encadena y lo escribe (triggeredById: null = "lo escribió el
 * job automático", mismo campo que ya documentaba esto desde Fase 1). Si la
 * API falla o no hay período nuevo, no hace nada — silencioso a propósito.
 */
export async function runIpcAutoFetch(tenantId: string): Promise<void> {
  const fetched = await fetchLatestIpcPeriod();
  if (!fetched) return;

  // Corre fuera de un request: la auditoría lo registra como "sistema".
  await runWithActor(SYSTEM_ACTOR, () => persistFetchedIpc(tenantId, fetched));
}

async function persistFetchedIpc(tenantId: string, fetched: FetchedIpcPeriod): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const lastRow = await tx.ipcIndexValue.findFirst({
      where: { tenantId },
      orderBy: { period: 'desc' },
    });
    if (lastRow && lastRow.period.getTime() >= fetched.period.getTime()) {
      return; // ya lo tenemos, nada para actualizar
    }

    const baseIndex = lastRow ? Number(lastRow.indexValue) : 100;
    const indexValue = Number((baseIndex * (1 + fetched.latestValuePct / 100)).toFixed(6));

    await tx.ipcIndexValue.upsert({
      where: { tenantId_period: { tenantId, period: fetched.period } },
      update: {
        indexValue,
        sourcePreviousValue: fetched.previousValuePct,
        sourceLatestValue: fetched.latestValuePct,
        triggeredById: null,
        fetchedAt: new Date(),
      },
      create: {
        tenantId,
        period: fetched.period,
        indexValue,
        sourcePreviousValue: fetched.previousValuePct,
        sourceLatestValue: fetched.latestValuePct,
        triggeredById: null,
      },
    });

    const row = await tx.ipcIndexValue.findUniqueOrThrow({
      where: { tenantId_period: { tenantId, period: fetched.period } },
      select: { id: true },
    });
    await audit(tx, tenantId, {
      entityType: 'IpcIndexValue',
      entityId: row.id,
      action: 'CREATE',
      summary: `IPC automático (datos.gob.ar) para ${fetched.period.toISOString().slice(0, 7)}: +${fetched.latestValuePct}%`,
      changes: {
        periodo: fetched.period.toISOString(),
        variacionPct: fetched.latestValuePct,
        variacionAnteriorPct: fetched.previousValuePct,
        indiceAnterior: baseIndex,
        indiceResultante: indexValue,
        origen: 'AUTOMATICO',
      },
    });
  });
}

/** Usado por el cron — itera todos los tenants (Fase 1 tiene uno solo, pero
 *  esto ya queda listo para cuando haya más). */
export async function runIpcAutoFetchForAllTenants(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    try {
      await runIpcAutoFetch(tenant.id);
    } catch (err) {
      console.error(`Error en el fetch automático de IPC del tenant ${tenant.id}:`, err);
    }
  }
}

function firstOfMonthUTC(date: Date, monthOffset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
}

/**
 * Decisión de negocio (ver CLAUDE.md "Fase 2 — IPC automático"): la serie se
 * actualiza en datos.gob.ar todos los 14 del mes siguiente. Pasado el día 14
 * sin que el período esperado esté guardado, el panel admin (nunca el
 * portal cliente) tiene que avisar en vez de dejar que Cami/Fede asuman que
 * el último valor guardado sigue vigente.
 */
export async function getIpcStaleness(tenantId: string): Promise<IpcStalenessStatus> {
  return withTenant(tenantId, async (tx) => {
    const lastRow = await tx.ipcIndexValue.findFirst({
      where: { tenantId },
      orderBy: { period: 'desc' },
    });

    const now = new Date();
    const monthsBack = now.getUTCDate() >= 14 ? 1 : 2;
    const expectedPeriod = firstOfMonthUTC(now, -monthsBack);

    const stale = !lastRow || lastRow.period.getTime() < expectedPeriod.getTime();
    if (!stale) return { stale: false, message: null };

    return {
      stale: true,
      message:
        'No se pudo obtener el valor actualizado del IPC. Comunicarse con administración: cargá el período manualmente acá abajo con el valor anterior y el último publicado.',
    };
  });
}
