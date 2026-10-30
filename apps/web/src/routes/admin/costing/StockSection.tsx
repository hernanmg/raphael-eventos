import { useState } from 'react';
import { StockAssignSchema, type StockPurchase } from '@raphael-eventos/shared';
import { useAssignStock, useStock } from '../../../hooks/useCosting';
import { useDashboard } from '../../../hooks/useAdmin';
import { formatCurrency, formatDate } from '../../../lib/format';
import { errorText } from '../../../lib/guestLinks';
import { ExpenseRow } from './ExpenseRow';
import { FormError } from './formErrors';

/**
 * Compras para stock (feedback 2026-10-23: compran carne en oferta para tener,
 * sin un evento ni un mes definido). No cuentan en ningún costeo hasta que se
 * asigna a un evento lo que se usó — todo o una parte, en $.
 */
export function StockSection() {
  const { data: stock, isLoading } = useStock();
  const [showUsedUp, setShowUsedUp] = useState(false);

  const available = (stock ?? []).filter((s) => s.remaining > 0);
  const usedUp = (stock ?? []).filter((s) => s.remaining <= 0);
  const totalRemaining = available.reduce((sum, s) => sum + s.remaining, 0);
  const visible = showUsedUp ? [...available, ...usedUp] : available;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold">Stock</h2>
        <p className="text-sm">
          Sin asignar: <span className="font-semibold">{formatCurrency(totalRemaining)}</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">
        Compras hechas para tener (ej. carne en oferta). Cuando las usás en un evento, asigná lo que
        se usó y pasa a su costeo. Se cargan con “+ Cargar gasto” → “Compra para stock”.
      </p>
      {isLoading && <p className="mt-3 text-sm text-muted">Cargando…</p>}
      {stock && stock.length === 0 && (
        <p className="mt-3 text-sm text-muted">No hay compras para stock cargadas.</p>
      )}
      {visible.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {visible.map((purchase) => (
            <StockPurchaseRow key={purchase.id} purchase={purchase} />
          ))}
        </ul>
      )}
      {usedUp.length > 0 && (
        <button
          type="button"
          onClick={() => setShowUsedUp((v) => !v)}
          className="mt-2 text-xs text-muted underline hover:text-ink"
        >
          {showUsedUp ? 'Ocultar las ya usadas' : `Ver las ya usadas (${usedUp.length})`}
        </button>
      )}
    </section>
  );
}

function StockPurchaseRow({ purchase }: { purchase: StockPurchase }) {
  const [assigning, setAssigning] = useState(false);
  return (
    <li className="py-2">
      {/* ExpenseRow ya renderiza su propio <li>: sin este <ul>, li dentro de li. */}
      <ul>
        <ExpenseRow expense={purchase} />
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted">
          Usado {formatCurrency(purchase.used)} · Queda{' '}
          <span className={purchase.remaining > 0 ? 'font-semibold text-ink' : ''}>
            {formatCurrency(purchase.remaining)}
          </span>
        </span>
        {purchase.remaining > 0 && !assigning && (
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="text-gold hover:underline"
          >
            Asignar a un evento
          </button>
        )}
      </div>
      {purchase.uses.length > 0 && (
        <ul className="mt-1 text-xs text-muted">
          {purchase.uses.map((use) => (
            <li key={use.id}>
              {formatDate(use.date)} · {use.eventName} · {formatCurrency(use.amount)}
            </li>
          ))}
        </ul>
      )}
      {assigning && <StockAssignForm purchase={purchase} onDone={() => setAssigning(false)} />}
    </li>
  );
}

function StockAssignForm({ purchase, onDone }: { purchase: StockPurchase; onDone: () => void }) {
  const { data: dashboard } = useDashboard();
  const assign = useAssignStock();
  const [eventId, setEventId] = useState('');
  const [amount, setAmount] = useState(String(purchase.remaining));
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [detail, setDetail] = useState('');
  const [localError, setLocalError] = useState<string>();

  const events = (dashboard?.dashboard.events ?? []).filter((e) => e.status !== 'CANCELADO');
  const field =
    'w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-ink';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = StockAssignSchema.safeParse({
      eventId,
      amount: amount.replace(',', '.'),
      date,
      detail,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message);
      return;
    }
    setLocalError(undefined);
    assign.mutate({ id: purchase.id, input: parsed.data }, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-2 flex flex-col gap-3 rounded-xl border border-line p-3 text-sm"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Evento</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={field}>
            <option value="">Elegí el evento…</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.eventDate ? ` — ${ev.eventDate.slice(0, 10)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Monto usado (queda {formatCurrency(purchase.remaining)})
          </span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Detalle (opcional)</span>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Ej. 8 kg de vacío"
          className={field}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={assign.isPending}
          className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {assign.isPending ? 'Asignando…' : 'Asignar'}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
      <FormError message={localError ?? (assign.error ? errorText(assign.error) : undefined)} />
    </form>
  );
}
