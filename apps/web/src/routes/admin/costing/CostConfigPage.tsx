import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  CostCategoryInput,
  CostCategoryKind,
  CostCategorySummary,
  TenantCostConfigSummary,
} from '@raphael-eventos/shared';
import {
  useCostCategories,
  useCostConfig,
  useCreateCostCategory,
  useDeleteCostCategory,
  useUpdateCostCategory,
  useUpdateCostConfig,
} from '../../../hooks/useCosting';
import { formatCurrency } from '../../../lib/format';
import { errorText } from '../../../lib/guestLinks';
import { FormError } from './formErrors';

// Misma convención visual que el Excel de Fede: amarillo = valores que carga
// a mano, verde = se calculan solos.
const EDITABLE_BADGE = 'bg-amber-100 text-amber-800';
const CALCULATED_BADGE = 'bg-emerald-100 text-emerald-800';

export default function CostConfigPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Configuración de costeo</h1>
        <Link
          to="/admin/gastos"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Cargar / ver gastos →
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Porcentajes y rubros del costeo. El costo de cada evento sale de los{' '}
        <Link to="/admin/gastos" className="underline">
          gastos reales
        </Link>{' '}
        cargados con su ticket; acá se define cómo se agrupan y se calcula. Todo lo{' '}
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${EDITABLE_BADGE}`}>
          amarillo
        </span>{' '}
        es editable.
      </p>

      <PercentagesForm />
      <CategoriesSection
        kind="FIJO"
        title="Gastos fijos del salón"
        help="Se prorratean entre los eventos de cada mes. El monto es el estimado mensual: si en el mes hay gastos reales cargados para el rubro, se usan esos."
        placeholder="Nuevo gasto fijo (ej. Alquiler)"
      />
      <CategoriesSection
        kind="INSUMO"
        title="Rubros de insumos"
        help="Compras para cada evento (como la hoja PRECIOS.): mercadería, bebidas, descartables…"
        placeholder="Nuevo rubro (ej. Bebidas)"
      />
      <CategoriesSection
        kind="SERVICIO"
        title="Rubros de servicios"
        help="Servicios contratados por evento (DJ, fotógrafo, seguridad…). También se usan como rubro de los proveedores."
        placeholder="Nuevo rubro (ej. DJ)"
      />
    </main>
  );
}

/** Los porcentajes se guardan como fracción (0,40) y se muestran como % (40). */
type PctKey = Exclude<keyof TenantCostConfigSummary, 'bankTransferFee'>;
const PCT_FIELDS: { key: PctKey; label: string }[] = [
  { key: 'gananciaPct', label: 'Ganancia %' },
  { key: 'roturaPct', label: 'Rotura %' },
  { key: 'ivaPct', label: 'IVA %' },
  { key: 'insumoRenegotiationPct', label: 'Aviso suba insumo %' },
  { key: 'advanceDepositCapPct', label: 'Tope de seña %' },
  { key: 'bankCreditTaxPct', label: 'Imp. créditos %' },
  { key: 'bankDebitTaxPct', label: 'Imp. débitos %' },
];

function toPercent(value: number): string {
  return String(Number((value * 100).toFixed(4)));
}

function PercentagesForm() {
  const { data, isLoading } = useCostConfig();
  const mutation = useUpdateCostConfig();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const { key } of PCT_FIELDS) next[key] = toPercent(data.config[key]);
    next.bankTransferFee = String(data.config.bankTransferFee);
    setValues(next);
  }, [data]);

  if (isLoading || !data) return <p className="mt-8 text-sm text-muted">Cargando…</p>;

  const num = (key: string) => Number((values[key] ?? '').replace(',', '.'));
  const invalid = Object.keys(values).some((k) => values[k] === '' || !Number.isFinite(num(k)));
  const markup = num('gananciaPct') + num('roturaPct') + num('ivaPct');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    const input = Object.fromEntries(
      PCT_FIELDS.map(({ key }) => [key, Number((num(key) / 100).toFixed(6))]),
    ) as Record<PctKey, number>;
    mutation.mutate({ ...input, bankTransferFee: num('bankTransferFee') });
  };

  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-2xl border border-line bg-paper p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {PCT_FIELDS.map(({ key, label }) => (
          <NumberField
            key={key}
            label={label}
            value={values[key] ?? ''}
            onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
          />
        ))}
        <NumberField
          label="Transferencia $ (por evento)"
          value={values.bankTransferFee ?? ''}
          onChange={(v) => setValues((s) => ({ ...s, bankTransferFee: v }))}
        />
      </div>
      <p className="mt-4 text-xs text-muted">
        Costo tarjeta = costo x 100 invitados × (1 + ganancia + rotura + IVA) ={' '}
        <span className={`rounded px-1.5 py-0.5 font-semibold ${CALCULATED_BADGE}`}>
          × {Number.isFinite(markup) ? (1 + markup / 100).toFixed(2) : '—'}
        </span>{' '}
        — los porcentajes se suman, como en el Excel de Fede. Los impuestos bancarios se aplican
        sobre el costo del evento.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={invalid || mutation.isPending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Guardar
        </button>
        {mutation.isSuccess && <span className="text-xs text-emerald-700">Guardado</span>}
        {invalid && <span className="text-xs text-red-600">Completá todos los valores</span>}
      </div>
      <FormError message={mutation.error ? errorText(mutation.error) : undefined} />
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className={`w-fit rounded px-1.5 py-0.5 text-xs font-semibold ${EDITABLE_BADGE}`}>
        {label}
      </span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
      />
    </label>
  );
}

function CategoriesSection({
  kind,
  title,
  help,
  placeholder,
}: {
  kind: CostCategoryKind;
  title: string;
  help: string;
  placeholder: string;
}) {
  const { data } = useCostCategories();
  const create = useCreateCostCategory();
  const update = useUpdateCostCategory();
  const remove = useDeleteCostCategory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const isFixed = kind === 'FIJO';

  const categories = (data?.categories ?? []).filter((c) => c.kind === kind);
  const monthlyTotal = categories.reduce((sum, c) => sum + c.monthlyAmount, 0);
  const withoutAmount = categories.filter((c) => c.monthlyAmount === 0).length;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted">{help}</p>
      {isFixed && (
        <p className="mt-2 text-xs text-muted">
          Total mensual estimado:{' '}
          <span className={`rounded px-1.5 py-0.5 font-semibold ${CALCULATED_BADGE}`}>
            {formatCurrency(monthlyTotal)}
          </span>
          {withoutAmount > 0 && (
            <span className="ml-2 text-amber-700">· {withoutAmount} sin monto estimado</span>
          )}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-1.5">
        {categories.map((category) =>
          editingId === category.id ? (
            <CategoryForm
              key={category.id}
              kind={kind}
              initial={category}
              submitLabel="Guardar"
              error={update.error}
              onCancel={() => setEditingId(null)}
              onSubmit={(input, done) =>
                update.mutate(
                  { id: category.id, input },
                  {
                    onSuccess: () => {
                      done();
                      setEditingId(null);
                    },
                  },
                )
              }
            />
          ) : (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
            >
              <span>
                {category.name}
                {category.guestScaled && (
                  <span className="ml-2 rounded bg-cream-2 px-1.5 py-0.5 text-xs">
                    cada 100 invitados
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                {isFixed && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      category.monthlyAmount === 0 ? 'bg-red-50 text-red-700' : EDITABLE_BADGE
                    }`}
                  >
                    {category.monthlyAmount === 0
                      ? 'sin monto'
                      : `${formatCurrency(category.monthlyAmount)}/mes`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    update.reset();
                    setEditingId(category.id);
                  }}
                  className="text-muted hover:text-ink"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(category.id)}
                  className="text-muted hover:text-red-600"
                >
                  Quitar
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      <FormError message={remove.error ? errorText(remove.error) : undefined} />
      <CategoryForm
        kind={kind}
        placeholder={placeholder}
        submitLabel="Agregar"
        error={create.error}
        onSubmit={(input, done) => create.mutate(input, { onSuccess: done })}
      />
    </section>
  );
}

function CategoryForm({
  kind,
  initial,
  placeholder,
  submitLabel,
  error,
  onSubmit,
  onCancel,
}: {
  kind: CostCategoryKind;
  initial?: CostCategorySummary;
  placeholder?: string;
  submitLabel: string;
  error: unknown;
  onSubmit: (input: CostCategoryInput, done: () => void) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.monthlyAmount) : '');
  const [guestScaled, setGuestScaled] = useState(initial?.guestScaled ?? false);
  const [localError, setLocalError] = useState<string>();
  const isFixed = kind === 'FIJO';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const monthlyAmount = amount.trim() === '' ? 0 : Number(amount.replace(',', '.'));
    if (!name.trim()) return setLocalError('Ingresá un nombre');
    if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
      return setLocalError('Monto inválido');
    }
    setLocalError(undefined);
    onSubmit(
      {
        kind,
        name: name.trim(),
        sortOrder: initial?.sortOrder ?? 0,
        monthlyAmount: isFixed ? monthlyAmount : 0,
        guestScaled: isFixed ? guestScaled : false,
      },
      () => {
        setName('');
        setAmount('');
        setGuestScaled(false);
      },
    );
  };

  const Wrapper = initial ? 'li' : 'div';
  return (
    <Wrapper className={initial ? 'rounded-lg border border-ink px-3 py-2 text-sm' : 'mt-3'}>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          autoFocus={Boolean(initial)}
          value={name}
          placeholder={placeholder}
          onChange={(e) => setName(e.target.value)}
          className="min-w-40 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
        />
        {isFixed && (
          <>
            <input
              inputMode="decimal"
              value={amount}
              placeholder="$ estimado/mes"
              onChange={(e) => setAmount(e.target.value)}
              className="w-36 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={guestScaled}
                onChange={(e) => setGuestScaled(e.target.checked)}
              />
              cada 100 invitados
            </label>
          </>
        )}
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">
            Cancelar
          </button>
        )}
      </form>
      <FormError message={localError ?? (error ? errorText(error) : undefined)} />
    </Wrapper>
  );
}
