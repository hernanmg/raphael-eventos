import type { IpcHistoryEntry } from '@raphael-eventos/shared';

// Presentación del IPC en términos de variación mensual (lo que publica el
// INDEC), no del índice interno base 100 — feedback del cliente: el "156,11"
// no le decía nada. El índice sigue siendo lo que usa el cálculo de tarjetas.
//
// Los acumulados se componen desde las variaciones mensuales guardadas
// (`sourceLatestValue` = % de ese mes en las tres fuentes: cron, carga manual
// y backfill), no desde el índice: el primer mes de la serie tiene índice 100
// pero su variación igual cuenta. Si falta algún mes del tramo, el acumulado
// es null en vez de un número que lo saltee en silencio.

function periodKey(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function variationsByPeriod(history: IpcHistoryEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of history) {
    const d = new Date(entry.period);
    map.set(periodKey(d.getUTCFullYear(), d.getUTCMonth()), entry.sourceLatestValue);
  }
  return map;
}

function compound(
  variations: Map<string, number>,
  year: number,
  fromMonth: number,
  toMonth: number,
): number | null {
  let factor = 1;
  for (let month = fromMonth; month <= toMonth; month++) {
    const value = variations.get(periodKey(year, month));
    if (value === undefined) return null;
    factor *= 1 + value / 100;
  }
  return (factor - 1) * 100;
}

export interface IpcAccumulated {
  /** Enero → este mes del mismo año. */
  yearToDate: number | null;
  /** Los 12 meses que terminan en este (interanual). */
  last12Months: number | null;
}

/** Acumulados de cada fila del historial, por id. */
export function accumulatedByEntry(history: IpcHistoryEntry[]): Map<string, IpcAccumulated> {
  const variations = variationsByPeriod(history);
  const result = new Map<string, IpcAccumulated>();
  for (const entry of history) {
    const d = new Date(entry.period);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    result.set(entry.id, {
      yearToDate: compound(variations, year, 0, month),
      last12Months: compound(variations, year, month - 11, month),
    });
  }
  return result;
}

const percentFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "+1,66%" / "-0,30%". */
export function formatVariation(pct: number): string {
  return `${pct > 0 ? '+' : ''}${percentFormatter.format(pct)}%`;
}

const monthYearFormatter = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' });
const shortMonthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' });

/** "agosto de 2026" (período = medianoche UTC del día 1, ver lib/format.ts). */
export function formatPeriod(iso: string): string {
  return monthYearFormatter.format(new Date(iso));
}

/** "agosto". */
export function formatPeriodMonth(iso: string): string {
  return monthFormatter.format(new Date(iso));
}

/** "ago". */
export function formatPeriodShort(iso: string): string {
  return shortMonthFormatter.format(new Date(iso)).replace('.', '');
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)).toISOString();
}

/**
 * Cuándo cambia el valor de las tarjetas impagas (feedback 2026-10-23: "no sé
 * si se actualizó la cuota"). El IPC de un mes se publica ~el 15 del mes
 * siguiente. Una tarjeta cargada (o ajustada) en un mes queda a precios de ese
 * mes: empieza a moverse con el IPC del mes siguiente — mismo criterio que
 * indexFactor en la API.
 */
export function ipcUpdateNote(
  latestIpcPeriod: string | null,
  cardBasePeriods: string[],
): { current: string; next: string; notYet: string | null } {
  if (!latestIpcPeriod) {
    return {
      current: 'Todavía no hay IPC cargado: las tarjetas valen lo que se cargó.',
      next: '',
      notYet: null,
    };
  }
  const nextPeriod = addMonths(latestIpcPeriod, 1);
  const latest = new Date(latestIpcPeriod).getTime();
  const pending = cardBasePeriods
    .filter((p) => new Date(p).getTime() >= latest)
    .sort()
    .at(-1);
  return {
    current: `Valores actualizados con el IPC de ${formatPeriod(latestIpcPeriod)}.`,
    next: `Próxima actualización: cuando se publique el IPC de ${formatPeriodMonth(nextPeriod)} (alrededor del 15 de ${formatPeriodMonth(addMonths(latestIpcPeriod, 2))}).`,
    notYet: pending
      ? `Las tarjetas cargadas o ajustadas en ${formatPeriod(pending)} están a precios de ese mes: empiezan a actualizarse con el IPC de ${formatPeriodMonth(addMonths(pending, 1))}.`
      : null,
  };
}
