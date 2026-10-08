import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MonthReport } from '@raphael-eventos/shared';
import { useYearReport } from '../../../hooks/usePhase4';
import { apiUrl } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: report, isLoading, isError } = useYearReport(year);
  const prev = year - 1;

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
            <Tile
              label="Eventos"
              value={String(report.totals.events)}
              sub={`${prev}: ${report.totals.previousYear.events} (${pctChange(report.totals.events, report.totals.previousYear.events)})`}
            />
            <Tile
              label="Comprometido"
              value={formatCurrency(report.totals.committed)}
              sub="valor actual de las tarjetas"
            />
            <Tile
              label="Cobrado de esos eventos"
              value={formatCurrency(report.totals.collectedForEvents)}
              sub={
                report.totals.committed > 0
                  ? `${((report.totals.collectedForEvents / report.totals.committed) * 100).toFixed(1)}% de lo comprometido`
                  : undefined
              }
            />
            <Tile
              label="Cobranza del año"
              value={formatCurrency(report.totals.cashIn)}
              sub={
                report.totals.previousYear.cashInAdjusted !== null
                  ? `${prev} ajustado por IPC: ${formatCurrency(report.totals.previousYear.cashInAdjusted)}`
                  : `${prev} nominal: ${formatCurrency(report.totals.previousYear.cashIn)}`
              }
            />
          </div>

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
            {exportLink(`/api/v1/admin/reports/year/export?year=${year}`, `Este reporte (${year})`)}
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

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
