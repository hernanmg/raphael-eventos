import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CardType, MonthReport, YearReport } from '@raphael-eventos/shared';
import { useYearReport } from '../../../hooks/usePhase4';
import { apiUrl } from '../../../lib/api';
import {
  CARD_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  formatCurrency,
  formatDate,
} from '../../../lib/format';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function pctOf(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';
}

function pctChange(current: number, previous: number | null): string {
  if (previous === null || previous === 0) return '—';
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

/**
 * Reportes operativos (Fase 4): ocupación, comprometido vs. cobrado e
 * interanual. Informativos, no contables. Los de margen/costeo viven en el
 * módulo Pro (detalle de cada evento) y no se repiten acá.
 */
export default function ReportsPage() {
  const [year, setYearState] = useState(() => new Date().getFullYear());
  // Filtro de la card "Eventos": vacío = todos los eventos del año.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const { data: report, isLoading, isError } = useYearReport(year, selectedIds);
  const prev = year - 1;
  const filtered = selectedIds.length > 0;

  const setYear = (update: (y: number) => number) => {
    setYearState(update);
    setSelectedIds([]); // los eventos elegidos son de otro año
  };
  const eventIdsQuery = filtered ? `&eventIds=${selectedIds.join(',')}` : '';

  const exportLink = (path: string, label: string) => (
    <span className="flex items-center gap-2">
      <span className="text-ink">{label}:</span>
      <a href={apiUrl(`${path}${path.includes('?') ? '&' : '?'}format=xlsx`)} className="underline">
        Excel
      </a>
      <a href={apiUrl(`${path}${path.includes('?') ? '&' : '?'}format=csv`)} className="underline">
        CSV
      </a>
    </span>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 print:max-w-none print:px-0 print:py-0">
      <Link to="/admin" className="text-sm text-muted hover:text-ink print:hidden">
        ← Panel admin
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Reportes {year}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Informativos, no contables. Comprometido = valor actual de las tarjetas (con IPC
            aplicado) de los eventos de cada mes; cobranza = pagos registrados por fecha de pago.
            Los cancelados no cuentan.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            aria-label="Año anterior"
          >
            ←
          </button>
          <span className="w-14 text-center font-semibold">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            aria-label="Año siguiente"
          >
            →
          </button>
        </div>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted">Calculando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos calcular el reporte.</p>}

      {report && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setShowEventPicker((v) => !v)}
              className={`rounded-2xl border p-4 text-left transition hover:border-ink ${
                filtered ? 'border-gold bg-gold/5' : 'border-line bg-paper'
              }`}
              aria-expanded={showEventPicker}
            >
              <p className="text-xs uppercase tracking-wide text-muted">
                Eventos{filtered ? ' · filtrado' : ''}
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">{report.totals.events}</p>
              <p className="mt-0.5 text-xs text-muted">
                {filtered
                  ? `${selectedIds.length} de ${report.eventOptions.length} elegidos`
                  : `${prev}: ${report.totals.previousYear.events} (${pctChange(report.totals.events, report.totals.previousYear.events)})`}
              </p>
              <p className="mt-1 text-xs text-gold print:hidden">
                {showEventPicker ? 'Cerrar' : 'Filtrar por evento ▾'}
              </p>
            </button>
            <Tile
              label="Comprometido"
              value={formatCurrency(report.totals.committed)}
              sub={`${report.cards.total.quantity} tarjetas · valor actual`}
            />
            <Tile
              label="Cobrado de esos eventos"
              value={formatCurrency(report.totals.collectedForEvents)}
              sub={`${pctOf(report.totals.collectedForEvents, report.totals.committed)} de lo comprometido`}
              extra={`${report.cards.total.paid} de ${report.cards.total.quantity} tarjetas pagas (${pctOf(report.cards.total.paid, report.cards.total.quantity)})`}
            />
            <Tile
              label="Cobranza del año"
              value={formatCurrency(report.totals.cashIn)}
              sub={`${report.cashInEventCount} ${report.cashInEventCount === 1 ? 'evento' : 'eventos'} con pagos en ${year}`}
              extra={
                filtered
                  ? undefined
                  : report.totals.previousYear.cashInAdjusted !== null
                    ? `${prev} ajustado por IPC: ${formatCurrency(report.totals.previousYear.cashInAdjusted)}`
                    : `${prev} nominal: ${formatCurrency(report.totals.previousYear.cashIn)}`
              }
            />
          </div>

          {showEventPicker && (
            <EventPicker
              options={report.eventOptions}
              selected={selectedIds}
              onChange={setSelectedIds}
            />
          )}
          {filtered && (
            <p className="mt-3 text-sm">
              Mostrando solo:{' '}
              <span className="font-medium">
                {report.eventOptions
                  .filter((e) => selectedIds.includes(e.id))
                  .map((e) => e.name)
                  .join(', ')}
              </span>{' '}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="ml-1 text-gold underline print:hidden"
              >
                ver todos
              </button>
            </p>
          )}

          <CardsBreakdown cards={report.cards} />

          <h2 className="mt-10 font-serif text-xl font-semibold">Ocupación</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Eventos</th>
                  <th className="px-3 py-2">15</th>
                  <th className="px-3 py-2">Egr.</th>
                  <th className="px-3 py-2">Boda</th>
                  <th className="px-3 py-2">Emp.</th>
                  <th className="px-3 py-2">Tentativas</th>
                  <th className="px-3 py-2">Cancelados</th>
                  <th className="px-3 py-2">{prev}</th>
                </tr>
              </thead>
              <tbody>
                {[...report.months, { ...report.totals, month: 0 } as MonthReport].map((m) => (
                  <tr
                    key={m.month}
                    className={`border-t border-line ${m.month === 0 ? 'bg-cream font-semibold' : ''}`}
                  >
                    <td className="px-3 py-1.5">{m.month === 0 ? 'Total' : MONTHS[m.month - 1]}</td>
                    <td className="px-3 py-1.5">{m.events}</td>
                    <td className="px-3 py-1.5 text-muted">{m.eventsByType.QUINCE}</td>
                    <td className="px-3 py-1.5 text-muted">{m.eventsByType.EGRESO}</td>
                    <td className="px-3 py-1.5 text-muted">{m.eventsByType.BODA}</td>
                    <td className="px-3 py-1.5 text-muted">{m.eventsByType.EMPRESARIAL}</td>
                    <td className="px-3 py-1.5">{m.tentative}</td>
                    <td className="px-3 py-1.5">{m.cancelled}</td>
                    <td className="px-3 py-1.5 text-muted">{m.previousYear.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 font-serif text-xl font-semibold">Comprometido vs. cobrado</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Comprometido</th>
                  <th className="px-3 py-2">Cobrado de esos eventos</th>
                  <th className="px-3 py-2">Cobranza del mes</th>
                  <th className="px-3 py-2">Cobranza {prev}</th>
                  <th className="px-3 py-2">{prev} ajustado IPC</th>
                  <th className="px-3 py-2">Var. real</th>
                </tr>
              </thead>
              <tbody>
                {[...report.months, { ...report.totals, month: 0 } as MonthReport].map((m) => (
                  <tr
                    key={m.month}
                    className={`border-t border-line ${m.month === 0 ? 'bg-cream font-semibold' : ''}`}
                  >
                    <td className="px-3 py-1.5">{m.month === 0 ? 'Total' : MONTHS[m.month - 1]}</td>
                    <td className="px-3 py-1.5">{formatCurrency(m.committed)}</td>
                    <td className="px-3 py-1.5">{formatCurrency(m.collectedForEvents)}</td>
                    <td className="px-3 py-1.5">{formatCurrency(m.cashIn)}</td>
                    <td className="px-3 py-1.5 text-muted">
                      {formatCurrency(m.previousYear.cashIn)}
                    </td>
                    <td className="px-3 py-1.5 text-muted">
                      {m.previousYear.cashInAdjusted === null
                        ? 'sin IPC'
                        : formatCurrency(m.previousYear.cashInAdjusted)}
                    </td>
                    <td className="px-3 py-1.5">
                      {pctChange(m.cashIn, m.previousYear.cashInAdjusted)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            "{prev} ajustado IPC" lleva la cobranza del mismo mes del año anterior a pesos de {year}{' '}
            con el índice guardado (índice del mes en {year} / índice del mes en {prev}). Donde dice
            "sin IPC" no hay índice cargado para alguno de los dos meses — la variación real queda
            sin calcular en vez de mostrar una comparación nominal engañosa.
          </p>

          <div className="mt-10 flex flex-col gap-2 rounded-2xl border border-line bg-paper p-5 text-sm print:hidden">
            <p className="font-serif text-lg font-semibold">Exportar</p>
            {exportLink(
              `/api/v1/admin/reports/year/export?year=${year}${eventIdsQuery}`,
              `Este reporte (${year}${filtered ? ', filtrado' : ''})`,
            )}
            {exportLink('/api/v1/admin/exports/events', 'Lista de eventos')}
            {exportLink('/api/v1/admin/exports/cards', 'Tarjetas de todos los eventos')}
            {exportLink('/api/v1/admin/exports/payments', 'Pagos')}
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-2 self-start rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
            >
              Imprimir / Guardar PDF
            </button>
            <p className="text-xs text-muted">
              La lista de invitados se exporta desde el detalle de cada evento.
            </p>
          </div>
        </>
      )}
    </main>
  );
}

function Tile({
  label,
  value,
  sub,
  extra,
}: {
  label: string;
  value: string;
  sub?: string;
  extra?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      {extra && <p className="mt-0.5 text-xs text-muted">{extra}</p>}
    </div>
  );
}

/** Selector de la card "Eventos": elegir uno o varios recalcula todo el
 *  reporte (cards y tablas) solo con esos eventos. */
function EventPicker({
  options,
  selected,
  onChange,
}: {
  options: YearReport['eventOptions'];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="mt-3 rounded-2xl border border-line bg-paper p-4 print:hidden">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Elegí uno o más eventos</p>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selected.length === 0}
          className="text-xs text-gold underline disabled:text-muted disabled:no-underline"
        >
          Todos los eventos
        </button>
      </div>
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No hay eventos este año.</p>
      ) : (
        <ul className="mt-2 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {options.map((event) => (
            <li key={event.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-cream">
                <input
                  type="checkbox"
                  checked={selected.includes(event.id)}
                  onChange={() => toggle(event.id)}
                />
                <span className="flex-1">{event.name}</span>
                <span className="text-xs text-muted">
                  {EVENT_TYPE_LABELS[event.type]} · {formatDate(event.eventDate)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tarjetas por tipo: cantidad, pagas y %. */
function CardsBreakdown({ cards }: { cards: YearReport['cards'] }) {
  const types = (Object.keys(cards.byType) as CardType[]).filter(
    (t) => cards.byType[t].quantity > 0,
  );
  if (types.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      {types.map((t) => {
        const c = cards.byType[t];
        return (
          <span key={t} className="rounded-full border border-line bg-paper px-3 py-1.5">
            <span className="font-semibold text-ink">{CARD_TYPE_LABELS[t]}</span>{' '}
            <span className="text-muted">
              {c.paid} / {c.quantity} pagas ({pctOf(c.paid, c.quantity)})
            </span>
          </span>
        );
      })}
      <span className="text-muted">
        "Pagas" = unidades asignadas en pagos con desglose por tarjeta.
      </span>
    </div>
  );
}
