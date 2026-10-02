import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  EventServiceCostInputSchema,
  EventSupplyLineInputSchema,
  type EventServiceCostInput,
  type EventSupplyLineInput,
} from '@raphael-eventos/shared';
import {
  useCreateServiceCost,
  useCreateSupplyLine,
  useDeleteServiceCost,
  useDeleteSupplyLine,
  useEventCosting,
  useFixedCostCategories,
  useServiceCostCategories,
  useSupplyCategories,
} from '../../../hooks/useCosting';
import { formatCurrency } from '../../../lib/format';

const SUPPLY_UNIT_LABELS = { KG: 'kg', LITROS: 'L', UNIDAD: 'un.' } as const;

/** Embebido en AdminEventDetailPage — solo se renderiza si tenant.plan === 'PRO'. */
export function EventCostingSection({ eventId }: { eventId: string }) {
  const [guestCountInput, setGuestCountInput] = useState<number | undefined>(undefined);
  const { data, isLoading } = useEventCosting(eventId, guestCountInput);

  if (isLoading) return <p className="mt-8 text-sm text-muted">Cargando costeo…</p>;
  if (!data) return null;

  const { costing } = data;

  return (
    <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-xl font-semibold">Costeo (Plan Pro)</h2>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
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
          · {costing.eventsInMonth} evento(s) en el mes · sale de la suma de las tarjetas cargadas,
          se puede pisar acá
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CostStat label="Insumos" value={costing.totalSupplyCost} />
        <CostStat label="Servicios" value={costing.totalServiceCost} />
        <CostStat label="Fijos prorrateados" value={costing.totalFixedCostProrated} />
        <div className="rounded-xl bg-cream-2 p-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            Costo neto acumulado hasta el momento
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatCurrency(costing.costoNeto)}</p>
        </div>
      </div>

      {costing.guestCount === 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Sin invitados cargados todavía — cargá tarjetas o poné una cantidad arriba para ver el
          costo por 100 invitados y el costo tarjeta final.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <CostStat label="Costo x 100 invitados" value={costing.costoPor100Invitados} />
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-800">Costo tarjeta</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">
              {formatCurrency(costing.costoTarjeta)}
            </p>
          </div>
        </div>
      )}

      <SupplyLinesTable eventId={eventId} lines={costing.supplyLines} />
      <ServiceCostsTable eventId={eventId} costs={costing.serviceCosts} />
    </div>
  );
}

function CostStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${emphasis ? 'text-ink' : 'text-ink/80'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function SupplyLinesTable({
  eventId,
  lines,
}: {
  eventId: string;
  lines: {
    id: string;
    categoryName: string;
    productName: string;
    quantity: number;
    unit: 'KG' | 'LITROS' | 'UNIDAD';
    unitCost: number;
    lineCost: number;
    renegotiationWarning: boolean;
  }[];
}) {
  const { data: categories } = useSupplyCategories();
  const create = useCreateSupplyLine(eventId);
  const remove = useDeleteSupplyLine(eventId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<EventSupplyLineInput>({
    resolver: zodResolver(EventSupplyLineInputSchema),
    defaultValues: { unit: 'UNIDAD' },
  });

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, { onSuccess: () => reset({ unit: 'UNIDAD' }) }),
  );

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-ink">Insumos</h3>
      {lines.length > 0 && (
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t border-line">
                <td className="py-1.5 pr-2 text-muted">{line.categoryName}</td>
                <td className="py-1.5 pr-2">
                  {line.productName}
                  {line.renegotiationWarning && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                      subió más del umbral
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-muted">
                  {line.quantity} {SUPPLY_UNIT_LABELS[line.unit]} × {formatCurrency(line.unitCost)}
                </td>
                <td className="py-1.5 pr-2 font-medium">{formatCurrency(line.lineCost)}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => remove.mutate(line.id)}
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <select
          className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('categoryId')}
        >
          <option value="">Rubro…</option>
          {categories?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Producto"
          className="w-40 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('productName')}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Cant."
          className="w-20 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('quantity', { valueAsNumber: true })}
        />
        <select
          className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('unit')}
        >
          {Object.entries(SUPPLY_UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Costo unit."
          className="w-28 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('unitCost', { valueAsNumber: true })}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Agregar
        </button>
      </form>
    </div>
  );
}

function ServiceCostsTable({
  eventId,
  costs,
}: {
  eventId: string;
  costs: {
    id: string;
    categoryName: string | null;
    employeeName: string | null;
    autoGenerated: boolean;
    amount: number;
    note: string | null;
  }[];
}) {
  const { data: categories } = useServiceCostCategories();
  useFixedCostCategories(); // precarga para que el resto de la pantalla no espere otro round-trip
  const create = useCreateServiceCost(eventId);
  const remove = useDeleteServiceCost(eventId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<EventServiceCostInput>({ resolver: zodResolver(EventServiceCostInputSchema) });

  const onSubmit = handleSubmit((values) => create.mutate(values, { onSuccess: () => reset() }));

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-ink">Gastos de servicio</h3>
      {costs.length > 0 && (
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {costs.map((cost) => (
              <tr key={cost.id} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  {cost.categoryName ?? cost.employeeName ?? cost.note ?? '—'}
                  {cost.autoGenerated && (
                    <span className="ml-2 rounded bg-cream-2 px-1.5 py-0.5 text-xs">
                      auto (personal)
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2 font-medium">{formatCurrency(cost.amount)}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => remove.mutate(cost.id)}
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <select
          className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('categoryId')}
        >
          <option value="">Rubro…</option>
          {categories?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Monto"
          className="w-28 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('amount', { valueAsNumber: true })}
        />
        <input
          placeholder="Nota (opcional)"
          className="w-40 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('note')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Agregar
        </button>
      </form>
    </div>
  );
}
