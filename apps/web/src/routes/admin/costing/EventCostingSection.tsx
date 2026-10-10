import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventCosting } from '../../../hooks/useCosting';
import { formatCurrency } from '../../../lib/format';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseRow } from './ExpenseRow';

/**
 * Costeo del evento (Plan Pro), embebido en AdminEventDetailPage. Sale de los
 * gastos reales cargados — agrupados por rubro → proveedor → ítems, como la
 * hoja PRECIOS. de Fede — más el prorrateo de los gastos del salón del mes y
 * los impuestos bancarios.
 */
export function EventCostingSection({ eventId }: { eventId: string }) {
  const [guestCountInput, setGuestCountInput] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [showFixed, setShowFixed] = useState(false);
  const { data, isLoading } = useEventCosting(eventId, guestCountInput);

  if (isLoading) return <p className="mt-8 text-sm text-muted">Cargando costeo…</p>;
  if (!data) return null;
  const { costing } = data;

  return (
    <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold">Costeo (Plan Pro)</h2>
        <Link to="/admin/costeo/config" className="text-xs text-muted underline">
          Rubros y porcentajes
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          Invitados para el cálculo:
          <input
            type="number"
            min={0}
            defaultValue={costing.guestCount}
            onBlur={(e) => setGuestCountInput(e.target.value ? Number(e.target.value) : undefined)}
            className="w-20 rounded border border-line px-1.5 py-0.5 text-sm outline-none focus:border-ink"
          />
        </label>
        <span>
          · {costing.eventsInMonth} evento(s) en el mes · sale de la suma de las tarjetas, se puede
          pisar acá
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CostStat label="Gastos del evento" value={costing.totalExpenses} />
        <CostStat label="Gastos del salón (prorrateo)" value={costing.totalFixedCostProrated} />
        <CostStat label="Impuestos bancarios" value={costing.bankTaxes.total} />
        <div className="rounded-xl bg-cream-2 p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Costo neto</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatCurrency(costing.costoNeto)}</p>
        </div>
      </div>

      {costing.guestCount === 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Sin invitados cargados todavía — cargá tarjetas o poné una cantidad arriba para ver el
          costo por 100 invitados y el costo tarjeta.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <CostStat label="Costo x 100 invitados" value={costing.costoPor100Invitados} />
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-800">
              Costo tarjeta (× {(1 + costing.markupPct).toFixed(2)})
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">
              {formatCurrency(costing.costoTarjeta)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Gastos del evento por rubro</h3>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            + Cargar gasto
          </button>
        )}
      </div>
      {creating && (
        <div className="mt-3">
          <ExpenseForm
            eventId={eventId}
            onDone={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
      {costing.groups.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay gastos cargados para este evento.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {costing.groups.map((group) => (
            <div
              key={group.categoryId ?? group.categoryName}
              className="rounded-xl border border-line p-3"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">{group.categoryName}</p>
                <p className="font-semibold">{formatCurrency(group.total)}</p>
              </div>
              {group.providers.map((provider) => (
                <div key={provider.providerId ?? 'none'} className="mt-2 pl-3">
                  {(group.providers.length > 1 || provider.providerName) && (
                    <div className="flex items-baseline justify-between text-xs text-muted">
                      <span>{provider.providerName ?? 'Sin proveedor'}</span>
                      <span>Subtotal {formatCurrency(provider.total)}</span>
                    </div>
                  )}
                  <ul className="divide-y divide-line">
                    {provider.expenses.map((expense) => (
                      <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        showCategory={false}
                        showProvider={false}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowFixed((v) => !v)}
          className="text-sm font-semibold text-ink"
        >
          {showFixed ? '▾' : '▸'} Gastos del salón prorrateados e impuestos (
          {formatCurrency(costing.totalFixedCostProrated + costing.bankTaxes.total)})
        </button>
        {showFixed && (
          <table className="mt-2 w-full text-left text-xs">
            <tbody>
              {costing.fixedCostBreakdown.map((f) => (
                <tr key={f.categoryId ?? f.categoryName} className="border-t border-line">
                  <td className="py-1 pr-2">
                    {f.categoryName}
                    {f.guestScaled && <span className="ml-1 text-muted">(cada 100 inv.)</span>}
                  </td>
                  <td className="py-1 pr-2">
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        f.source === 'REAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {f.source === 'REAL' ? 'real' : 'estimado'}
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-muted">{formatCurrency(f.monthlyBase)}/mes</td>
                  <td className="py-1 text-right font-medium">
                    {formatCurrency(f.proratedAmount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-1 pr-2" colSpan={3}>
                  Impuestos bancarios (créditos/débitos{' '}
                  {formatCurrency(costing.bankTaxes.creditDebit)} + transferencia{' '}
                  {formatCurrency(costing.bankTaxes.transferFee)})
                </td>
                <td className="py-1 text-right font-medium">
                  {formatCurrency(costing.bankTaxes.total)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CostStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink/80">{formatCurrency(value)}</p>
    </div>
  );
}
