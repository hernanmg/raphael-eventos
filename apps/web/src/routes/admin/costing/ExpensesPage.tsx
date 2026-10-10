import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useExpenses } from '../../../hooks/useCosting';
import { COST_KIND_LABELS, formatCurrency } from '../../../lib/format';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseRow } from './ExpenseRow';

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m! - 1]} ${y}`;
}

/**
 * Gastos del mes (feedback 2026-10): carga de cada gasto con su ticket, y los
 * totales por rubro se arman solos — el costeo de cada evento sale de acá,
 * no de un número tipeado.
 */
export default function ExpensesPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError } = useExpenses({ month });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Gastos</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Cada gasto con su rubro, proveedor y ticket. Los de un evento suman a su costeo; los del
            salón se prorratean entre los eventos del mes.{' '}
            <Link to="/admin/costeo/config" className="underline">
              Rubros y porcentajes
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            aria-label="Mes anterior"
          >
            ←
          </button>
          <span className="w-36 text-center font-semibold capitalize">{monthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-6">
        {creating ? (
          <ExpenseForm
            defaultPeriod={month}
            onDone={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            + Cargar gasto
          </button>
        )}
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar los gastos.</p>}

      {data && (
        <>
          <section className="mt-8 rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-semibold">Total por rubro</h2>
              <p className="text-lg font-semibold">{formatCurrency(data.total)}</p>
            </div>
            {data.byCategory.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Sin gastos cargados en {monthLabel(month)}.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <tbody>
                  {data.byCategory.map((c) => (
                    <tr key={c.categoryId ?? c.categoryName} className="border-t border-line">
                      <td className="py-1.5 pr-2">{c.categoryName}</td>
                      <td className="py-1.5 pr-2 text-xs text-muted">
                        {c.kind ? COST_KIND_LABELS[c.kind] : 'Personal'}
                      </td>
                      <td className="py-1.5 pr-2 text-xs text-muted">{c.count} gasto(s)</td>
                      <td className="py-1.5 text-right font-medium">{formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {data.expenses.length > 0 && (
            <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
              <h2 className="font-serif text-lg font-semibold">Detalle</h2>
              <ul className="mt-2 divide-y divide-line">
                {data.expenses.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} showEvent />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
