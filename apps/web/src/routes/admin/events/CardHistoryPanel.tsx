import { useCardHistory } from '../../../hooks/useAdmin';
import { CARD_TYPE_LABELS, formatCurrency, formatDate } from '../../../lib/format';
import { formatPeriod, formatVariation } from '../../../lib/ipc';

/**
 * Historial de una tarjeta (feedback 2026-10-23: click en "Pagas 18/40"):
 * qué pagos cubren esas 18 y a qué valor quedó congelada cada una, y la
 * evolución del valor unitario (alta, IPC de cada mes, ajustes manuales).
 */
export function CardHistoryPanel({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useCardHistory(cardId);

  return (
    <div className="rounded-xl border border-line bg-cream/50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-serif text-base font-semibold">
          {data ? `Tarjetas ${CARD_TYPE_LABELS[data.card.cardType]}` : 'Historial'}
        </p>
        <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink">
          Cerrar
        </button>
      </div>
      {isLoading && <p className="mt-2 text-muted">Cargando…</p>}
      {isError && <p className="mt-2 text-red-600">No pudimos cargar el historial.</p>}

      {data && (
        <>
          <p className="mt-1 text-xs text-muted">
            {data.card.quantityPaid} de {data.card.quantity} pagas
            {data.card.quantityPaid > 0 && ` (${formatCurrency(data.card.paidValue)})`}. Las que
            faltan pagar valen hoy {formatCurrency(data.card.unitValue)} c/u.
          </p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Pagos que las cubren
          </p>
          {data.allocations.length === 0 ? (
            <p className="mt-1 text-xs text-muted">
              Ningún pago tiene asignadas tarjetas de este tipo todavía.
            </p>
          ) : (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-1 pr-2">Fecha</th>
                    <th className="py-1 pr-2">Cant.</th>
                    <th className="py-1 pr-2">Valor c/u (fijo)</th>
                    <th className="py-1 pr-2">Subtotal</th>
                    <th className="py-1">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {data.allocations.map((a, i) => (
                    <tr key={`${a.paymentId}-${i}`} className="border-t border-line">
                      <td className="whitespace-nowrap py-1.5 pr-2">{formatDate(a.paymentDate)}</td>
                      <td className="py-1.5 pr-2">{a.quantity}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{formatCurrency(a.unitValue)}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{formatCurrency(a.subtotal)}</td>
                      <td className="py-1.5 text-xs text-muted">
                        {formatCurrency(a.paymentAmount)}
                        {a.note && ` — ${a.note}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Evolución del valor por tarjeta
          </p>
          <ul className="mt-1 flex flex-col">
            {[...data.valueHistory].reverse().map((point, i) => (
              <li
                key={`${point.period}-${point.kind}-${i}`}
                className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 first:border-0"
              >
                <span className="first-letter:uppercase">
                  {formatPeriod(point.period)}{' '}
                  <span className="text-xs text-muted">
                    {point.kind === 'ALTA' && '· valor al cargar el evento'}
                    {point.kind === 'IPC' &&
                      point.variationPct !== null &&
                      `· IPC ${formatVariation(point.variationPct)}`}
                    {point.kind === 'AJUSTE' && `· ajuste manual: ${point.reason}`}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatCurrency(point.unitValue)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
