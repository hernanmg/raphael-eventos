/**
 * Backfill ÚNICO del historial de IPC (no es un proceso recurrente: los
 * períodos nuevos los sigue trayendo el cron diario, jobs/ipcCron.ts).
 *
 * Para qué: el interanual ajustado por IPC de /admin/reportes necesita el
 * índice de los mismos meses del año anterior, y la base solo tenía IPC
 * desde que arrancó el sistema. Trae la serie de variación intermensual de
 * datos.gob.ar (la misma que usa el cron) desde enero del año anterior al
 * dato más viejo del tenant, y la guarda en IpcIndexValue igual que el
 * resto (+ AuditLog como sistema).
 *
 * Reglas (para no cambiar ningún saldo ya calculado):
 *  - NUNCA modifica filas existentes — el IPC no se recalcula hacia atrás.
 *  - Encadena desde la fila existente más vieja dentro del rango: hacia
 *    atrás idx(m-1) = idx(m) / (1 + v(m)/100); hacia adelante
 *    idx(m) = idx(m-1) × (1 + v(m)/100), re-anclando en cada fila existente.
 *    Así los cocientes entre índices (lo único que usa indexFactor) quedan
 *    consistentes con lo ya guardado.
 *  - No agrega períodos posteriores a la última fila existente (eso cambia
 *    el "último índice" de todos los saldos — es trabajo del cron).
 *  - Un hueco entre filas existentes solo se rellena si ninguna tarjeta
 *    tiene basePeriod dentro del tramo afectado (si no, cambiaría su saldo).
 *
 * Uso (desde apps/api):  npm run ipc:backfill -- --dry-run   (muestra el plan)
 *                        npm run ipc:backfill                (escribe)
 * Idempotente: correrlo de nuevo no inserta nada que ya exista.
 */
import { prisma } from '../db/prisma';
import { withTenant } from '../db/withTenant';
import { audit } from '../lib/audit';
import { fetchIpcSeries, type IpcSeriesPoint } from '../lib/ipc';
import { runWithActor } from '../lib/requestContext';

const ACTOR = { userId: null, label: 'Sistema (backfill único de IPC desde datos.gob.ar)' };
const dryRun = process.argv.includes('--dry-run');

function ym(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

interface PlannedRow {
  period: Date;
  indexValue: number;
  sourcePreviousValue: number;
  sourceLatestValue: number;
}

/** Año más viejo con datos del tenant (eventos, pagos, consultas, tarjetas). */
async function oldestDataYear(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    const [event, payment, lead, card] = await Promise.all([
      tx.event.aggregate({ where: { tenantId }, _min: { eventDate: true } }),
      tx.payment.aggregate({ where: { tenantId }, _min: { paymentDate: true } }),
      tx.lead.aggregate({ where: { tenantId }, _min: { interestedDate: true } }),
      tx.eventCard.aggregate({ where: { tenantId }, _min: { basePeriod: true } }),
    ]);
    const dates = [
      event._min.eventDate,
      payment._min.paymentDate,
      lead._min.interestedDate,
      card._min.basePeriod,
    ].filter((d): d is Date => d !== null);
    const oldest = dates.length ? Math.min(...dates.map((d) => d.getTime())) : Date.now();
    return new Date(oldest).getUTCFullYear();
  });
}

async function planTenant(tenantId: string, series: IpcSeriesPoint[], start: Date) {
  const existing = await withTenant(tenantId, (tx) =>
    tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
  );
  const cards = await withTenant(tenantId, (tx) =>
    tx.eventCard.findMany({ where: { tenantId }, select: { basePeriod: true } }),
  );

  const variation = new Map(series.map((p) => [ym(p.period), p.valuePct]));
  const existingByYm = new Map(existing.map((r) => [ym(r.period), Number(r.indexValue)]));
  const months = series.filter((p) => p.period.getTime() >= start.getTime()).map((p) => p.period);
  const skipped: string[] = [];

  if (months.length === 0)
    return { planned: [] as PlannedRow[], skipped, note: 'la API no devolvió meses en el rango' };

  // Contigüidad: un mes faltante en la serie rompería el encadenado.
  for (let i = 1; i < months.length; i++) {
    if (ym(addMonths(months[i - 1]!, 1)) !== ym(months[i]!)) {
      throw new Error(`La serie tiene un hueco entre ${ym(months[i - 1]!)} y ${ym(months[i]!)}`);
    }
  }

  const latestExisting = existing.length ? existing[existing.length - 1]!.period : null;
  const anchorIdx = months.findIndex((m) => existingByYm.has(ym(m)));
  if (existing.length > 0 && anchorIdx === -1) {
    throw new Error(
      'Hay IPC guardado pero ninguna fila cae dentro del rango de la serie: no se puede encadenar de forma consistente',
    );
  }

  const index = new Map<string, number>();
  if (anchorIdx === -1) {
    // Tenant sin IPC: arranca en 100 en el primer mes (mismo base que addIpcEntry).
    index.set(ym(months[0]!), 100);
  } else {
    index.set(ym(months[anchorIdx]!), existingByYm.get(ym(months[anchorIdx]!))!);
    for (let i = anchorIdx - 1; i >= 0; i--) {
      const next = months[i + 1]!;
      index.set(ym(months[i]!), index.get(ym(next))! / (1 + variation.get(ym(next))! / 100));
    }
  }
  const from = anchorIdx === -1 ? 0 : anchorIdx;
  for (let i = from + 1; i < months.length; i++) {
    const key = ym(months[i]!);
    index.set(
      key,
      existingByYm.get(key) ?? index.get(ym(months[i - 1]!))! * (1 + variation.get(key)! / 100),
    );
  }

  const planned: PlannedRow[] = [];
  for (const month of months) {
    const key = ym(month);
    if (existingByYm.has(key)) continue;
    if (latestExisting && month.getTime() > latestExisting.getTime()) {
      skipped.push(`${key} (posterior al último IPC guardado: lo trae el cron)`);
      continue;
    }
    // Hueco entre filas existentes: ¿alguna tarjeta tomaría esta fila como base?
    const nextExisting = existing.find((r) => r.period.getTime() > month.getTime());
    if (nextExisting && existing.some((r) => r.period.getTime() < month.getTime())) {
      const affected = cards.some(
        (c) =>
          c.basePeriod.getTime() >= month.getTime() &&
          c.basePeriod.getTime() < nextExisting.period.getTime(),
      );
      if (affected) {
        skipped.push(`${key} (hay tarjetas con período base en ese tramo: cambiaría su saldo)`);
        continue;
      }
    }
    const previousVariation = variation.get(ym(addMonths(month, -1)));
    planned.push({
      period: month,
      indexValue: Number(index.get(key)!.toFixed(6)),
      sourceLatestValue: Number(variation.get(key)!.toFixed(6)),
      sourcePreviousValue: Number((previousVariation ?? variation.get(key)!).toFixed(6)),
    });
  }
  return {
    planned,
    skipped,
    note: anchorIdx === -1 ? 'sin IPC previo: base 100' : `anclado en ${ym(months[anchorIdx]!)}`,
  };
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  for (const tenant of tenants) {
    const oldestYear = await oldestDataYear(tenant.id);
    // El interanual compara contra el año anterior al dato más viejo.
    const start = new Date(Date.UTC(oldestYear - 1, 0, 1));
    // Un mes antes, para tener la "variación anterior" del primer período.
    const series = await fetchIpcSeries(addMonths(start, -1).toISOString().slice(0, 10));
    const { planned, skipped, note } = await planTenant(tenant.id, series, start);

    console.log(`\nTenant ${tenant.slug}: desde ${ym(start)} (${note})`);
    for (const row of planned) {
      console.log(
        `  + ${ym(row.period)}  variación ${row.sourceLatestValue.toFixed(2)}%  índice ${row.indexValue.toFixed(4)}`,
      );
    }
    for (const s of skipped) console.log(`  - salteado ${s}`);
    if (planned.length === 0) console.log('  Nada para insertar.');

    if (dryRun || planned.length === 0) continue;

    await runWithActor(ACTOR, () =>
      withTenant(tenant.id, async (tx) => {
        for (const row of planned) {
          const created = await tx.ipcIndexValue.create({
            data: { tenantId: tenant.id, triggeredById: null, ...row },
          });
          await audit(tx, tenant.id, {
            entityType: 'IpcIndexValue',
            entityId: created.id,
            action: 'CREATE',
            summary: `IPC histórico (backfill) para ${ym(row.period)}: +${row.sourceLatestValue.toFixed(2)}%`,
            changes: {
              periodo: row.period.toISOString(),
              variacionPct: row.sourceLatestValue,
              variacionAnteriorPct: row.sourcePreviousValue,
              indiceResultante: row.indexValue,
              origen: 'BACKFILL',
            },
          });
        }
      }),
    );
    console.log(`  ✓ ${planned.length} período(s) insertados.`);
  }
  if (dryRun) console.log('\n(--dry-run: no se escribió nada)');
}

main()
  .catch((err) => {
    console.error('Backfill de IPC falló:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
