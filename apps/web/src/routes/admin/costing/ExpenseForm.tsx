import { useState } from 'react';
import {
  ExpenseInputSchema,
  type ExpenseInput,
  type ExpenseSummary,
  type SupplyUnit,
} from '@raphael-eventos/shared';
import { useCostCategories, useSaveExpense } from '../../../hooks/useCosting';
import { useAdminProviders } from '../../../hooks/usePhase4';
import { useDashboard } from '../../../hooks/useAdmin';
import { COST_KIND_LABELS, SUPPLY_UNIT_LABELS, formatCurrency } from '../../../lib/format';
import { errorText } from '../../../lib/guestLinks';
import { FormError } from './formErrors';

interface ItemRow {
  productName: string;
  presentation: string;
  quantity: string;
  unit: SupplyUnit;
  unitCost: string;
}

const EMPTY_ITEM: ItemRow = {
  productName: '',
  presentation: '',
  quantity: '',
  unit: 'UNIDAD',
  unitCost: '',
};

const inputClass =
  'rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-ink disabled:bg-cream';

function toNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Carga/edición de un gasto: rubro, proveedor, monto, detalle libre, ítems
 * opcionales (producto, presentación, cantidad, unidad, precio — estructura de
 * la hoja PRECIOS. de Fede) y foto/PDF del ticket como respaldo (sin OCR).
 * Con `eventId` fijo se usa desde el costeo del evento; sin él, el admin
 * elige si el gasto es de un evento o del salón en un mes.
 */
export function ExpenseForm({
  eventId,
  defaultPeriod,
  initial,
  onDone,
  onCancel,
}: {
  eventId?: string;
  defaultPeriod?: string;
  initial?: ExpenseSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: categoriesData } = useCostCategories();
  const { data: providersData } = useAdminProviders();
  const { data: dashboard } = useDashboard();
  const save = useSaveExpense();

  const [target, setTarget] = useState<'event' | 'month'>(
    initial ? (initial.eventId ? 'event' : 'month') : eventId ? 'event' : 'month',
  );
  const [selectedEventId, setSelectedEventId] = useState(initial?.eventId ?? eventId ?? '');
  const [period, setPeriod] = useState(
    initial?.period ?? defaultPeriod ?? new Date().toISOString().slice(0, 7),
  );
  const [date, setDate] = useState(initial ? initial.date.slice(0, 10) : today());
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [providerId, setProviderId] = useState(initial?.providerId ?? '');
  const [detail, setDetail] = useState(initial?.detail ?? '');
  const [amount, setAmount] = useState(
    initial && initial.items.length === 0 ? String(initial.amount) : '',
  );
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items.map((i) => ({
      productName: i.productName,
      presentation: i.presentation ?? '',
      quantity: String(i.quantity),
      unit: i.unit,
      unitCost: String(i.unitCost),
    })) ?? [],
  );
  const [receipt, setReceipt] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [localError, setLocalError] = useState<string>();

  const categories = categoriesData?.categories ?? [];
  const providers = (providersData?.providers ?? []).filter(
    (p) => p.active || p.id === initial?.providerId,
  );
  const matchingProviders = providers.filter((p) => p.costCategoryId === categoryId);
  const otherProviders = providers.filter((p) => p.costCategoryId !== categoryId);
  const itemsTotal = items.reduce(
    (sum, i) => sum + (toNumber(i.quantity) || 0) * (toNumber(i.unitCost) || 0),
    0,
  );
  const fixedEvent = Boolean(eventId);

  const updateItem = (index: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = {
      eventId: target === 'event' ? selectedEventId : '',
      period: target === 'month' ? period : '',
      date,
      categoryId,
      providerId,
      amount: items.length > 0 ? '' : amount.replace(',', '.'),
      detail,
      items: items.map((i) => ({
        productName: i.productName,
        presentation: i.presentation,
        quantity: i.quantity.replace(',', '.'),
        unit: i.unit,
        unitCost: i.unitCost.replace(',', '.'),
      })),
      removeReceipt,
    };
    const parsed = ExpenseInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path[0] === 'items' ? `Ítem ${Number(issue.path[1]) + 1}: ` : '';
      setLocalError(
        `${where}${/expected number|nan/i.test(issue?.message ?? '') ? 'completá los números' : issue?.message}`,
      );
      return;
    }
    if (target === 'event' && !selectedEventId) return setLocalError('Elegí el evento');
    setLocalError(undefined);
    save.mutate(
      { id: initial?.id ?? null, input: parsed.data as ExpenseInput, receipt },
      { onSuccess: onDone },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-ink bg-paper p-5 text-sm"
    >
      <p className="font-serif text-lg font-semibold">
        {initial ? 'Editar gasto' : 'Cargar gasto'}
      </p>
      {initial?.autoSource && (
        <p className="rounded-lg bg-cream px-3 py-2 text-xs text-muted">
          Este gasto lo generó el sistema (personal). Si lo editás, queda marcado como ajustado a
          mano y no se vuelve a pisar solo.
        </p>
      )}

      {!fixedEvent && (
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={target === 'event'} onChange={() => setTarget('event')} />
            Gasto de un evento
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={target === 'month'} onChange={() => setTarget('month')} />
            Gasto del salón (se prorratea entre los eventos del mes)
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {!fixedEvent && target === 'event' && (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-muted">Evento</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className={inputClass}
            >
              <option value="">Elegí el evento…</option>
              {dashboard?.dashboard.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.eventDate ? ` — ${ev.eventDate.slice(0, 10)}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {target === 'month' && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Mes del gasto</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Fecha del ticket</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Rubro</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">Elegí el rubro…</option>
            {(['INSUMO', 'SERVICIO', 'FIJO'] as const).map((kind) => (
              <optgroup key={kind} label={COST_KIND_LABELS[kind]}>
                {categories
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Proveedor (opcional)</span>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin proveedor</option>
            {matchingProviders.length > 0 && (
              <optgroup label="De este rubro">
                {matchingProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {otherProviders.length > 0 && (
              <optgroup label="Otros proveedores">
                {otherProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Monto total {items.length > 0 && '(suma de los ítems)'}
          </span>
          <input
            inputMode="decimal"
            disabled={items.length > 0}
            value={items.length > 0 ? String(Number(itemsTotal.toFixed(2))) : amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Detalle (opcional)</span>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
          placeholder="Ej. compra semanal, factura de luz de octubre…"
          className={inputClass}
        />
      </label>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Ítems (opcional)
          </span>
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM }])}
            className="text-xs text-gold hover:underline"
          >
            + Agregar ítem
          </button>
        </div>
        {items.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="hidden grid-cols-[2fr_1fr_0.8fr_0.8fr_1fr_1fr_auto] gap-2 text-xs text-muted sm:grid">
              <span>Producto</span>
              <span>Presentación</span>
              <span>Cantidad</span>
              <span>Unidad</span>
              <span>Precio unit.</span>
              <span>Subtotal</span>
              <span />
            </div>
            {items.map((item, index) => {
              const lineTotal = (toNumber(item.quantity) || 0) * (toNumber(item.unitCost) || 0);
              return (
                <div
                  key={index}
                  className="grid grid-cols-2 gap-2 border-b border-line pb-2 sm:grid-cols-[2fr_1fr_0.8fr_0.8fr_1fr_1fr_auto] sm:border-0 sm:pb-0"
                >
                  <input
                    aria-label="Producto"
                    placeholder="Producto"
                    value={item.productName}
                    onChange={(e) => updateItem(index, { productName: e.target.value })}
                    className={`${inputClass} col-span-2 sm:col-span-1`}
                  />
                  <input
                    aria-label="Presentación"
                    placeholder="x6, 5L…"
                    value={item.presentation}
                    onChange={(e) => updateItem(index, { presentation: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    aria-label="Cantidad"
                    inputMode="decimal"
                    placeholder="Cant."
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    className={inputClass}
                  />
                  <select
                    aria-label="Unidad"
                    value={item.unit}
                    onChange={(e) => updateItem(index, { unit: e.target.value as SupplyUnit })}
                    className={inputClass}
                  >
                    {Object.entries(SUPPLY_UNIT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Precio unitario"
                    inputMode="decimal"
                    placeholder="$ unit."
                    value={item.unitCost}
                    onChange={(e) => updateItem(index, { unitCost: e.target.value })}
                    className={inputClass}
                  />
                  <span className="self-center font-medium">{formatCurrency(lineTotal)}</span>
                  <button
                    type="button"
                    onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                    className="self-center text-xs text-muted hover:text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">Ticket (foto o PDF, opcional — solo respaldo)</span>
        {initial?.receiptName && !removeReceipt && !receipt && (
          <span className="text-xs">
            Adjunto: {initial.receiptName}{' '}
            <button
              type="button"
              onClick={() => setRemoveReceipt(true)}
              className="text-muted underline hover:text-red-600"
            >
              quitar
            </button>
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {save.isPending ? 'Guardando…' : 'Guardar gasto'}
        </button>
        <button type="button" onClick={onCancel} className="text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
      <FormError message={localError ?? (save.error ? errorText(save.error) : undefined)} />
    </form>
  );
}
