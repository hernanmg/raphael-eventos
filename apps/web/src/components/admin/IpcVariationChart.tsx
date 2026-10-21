import type { IpcHistoryEntry } from '@raphael-eventos/shared';
import { formatPeriod, formatPeriodShort, formatVariation } from '../../lib/ipc';

/**
 * Barras de la variación mensual de los últimos 12 períodos guardados. Una
 * sola serie (dorado), base en 0 — si algún mes hay deflación la barra baja
 * de la línea de base. Etiqueta directa solo en el último mes; el resto del
 * detalle está en el tooltip (hover/foco) y en la tabla del historial.
 */
export function IpcVariationChart({ history }: { history: IpcHistoryEntry[] }) {
  // `history` viene ordenado del más nuevo al más viejo.
  const months = history.slice(0, 12).reverse();
  if (months.length < 2) return null;

  const values = months.map((entry) => entry.sourceLatestValue);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  // Altura útil del área de barras: deja aire arriba para la etiqueta del último mes.
  const usable = 82;
  const zero = (-min / range) * usable;

  return (
    <figure className="mt-6 rounded-2xl border border-line bg-paper p-5 shadow-card">
      <figcaption className="text-xs uppercase tracking-wide text-muted">
        Variación mensual · últimos {months.length} meses
      </figcaption>
      <ul className="mt-4 flex h-40 items-stretch gap-1.5 sm:gap-2">
        {months.map((entry, index) => {
          const value = entry.sourceLatestValue;
          const height = Math.max((Math.abs(value) / range) * usable, value === 0 ? 0 : 1.5);
          const isLast = index === months.length - 1;
          const label = `${formatPeriod(entry.period)}: ${formatVariation(value)}`;
          return (
            <li key={entry.id} className="flex min-w-0 flex-1 flex-col">
              <div
                tabIndex={0}
                aria-label={label}
                className="group relative flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {min < 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-x-1 h-px bg-line"
                    style={{ bottom: `${zero}%` }}
                  />
                )}
                <span
                  className={`absolute inset-x-[15%] ${
                    value >= 0 ? 'rounded-b-sm rounded-t' : 'rounded-b rounded-t-sm'
                  } ${isLast ? 'bg-gold' : 'bg-gold/55 group-hover:bg-gold group-focus-visible:bg-gold'}`}
                  style={
                    value >= 0
                      ? { bottom: `${zero}%`, height: `${height}%` }
                      : { bottom: `${zero - height}%`, height: `${height}%` }
                  }
                />
                {isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 text-center text-[11px] font-semibold text-ink tabular-nums group-hover:invisible"
                    style={{ bottom: `${zero + (value >= 0 ? height : 0) + 2}%` }}
                  >
                    {formatVariation(value)}
                  </span>
                )}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden ${tooltipAnchor(index, months.length)} whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-card group-hover:block group-focus-visible:block`}
                >
                  <span className="inline-block first-letter:uppercase">
                    {formatPeriod(entry.period)}
                  </span>
                  <span className="ml-2 font-semibold tabular-nums">{formatVariation(value)}</span>
                </span>
              </div>
              <span
                aria-hidden="true"
                className="mt-1.5 truncate text-center text-[10px] font-semibold uppercase text-muted"
              >
                {formatPeriodShort(entry.period)}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

// Centrado sobre la barra, salvo en los extremos: ahí se alinea al borde para
// no salirse del gráfico (en mobile el tooltip de las primeras barras quedaba
// cortado a la izquierda).
function tooltipAnchor(index: number, count: number): string {
  if (index < count / 3) return 'left-0';
  if (index >= (count * 2) / 3) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}
