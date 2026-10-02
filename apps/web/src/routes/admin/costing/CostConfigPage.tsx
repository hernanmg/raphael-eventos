import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  FixedCostCategoryInputSchema,
  ServiceCostCategoryInputSchema,
  SupplyCategoryInputSchema,
  TenantCostConfigInputSchema,
  type FixedCostCategoryInput,
  type ServiceCostCategoryInput,
  type SupplyCategoryInput,
  type TenantCostConfigInput,
} from '@raphael-eventos/shared';
import {
  useCostConfig,
  useCreateFixedCostCategory,
  useCreateServiceCostCategory,
  useCreateSupplyCategory,
  useDeleteFixedCostCategory,
  useDeleteServiceCostCategory,
  useDeleteSupplyCategory,
  useFixedCostCategories,
  useServiceCostCategories,
  useSupplyCategories,
  useUpdateCostConfig,
} from '../../../hooks/useCosting';
import { formatCurrency } from '../../../lib/format';

// Misma convención visual que ya usa Fede en su Excel de costeo (ver
// CLAUDE.md): amarillo = valores que carga a mano, verde = se calculan
// solos. La replicamos acá para que la pantalla le resulte familiar.
const EDITABLE_BADGE = 'bg-amber-100 text-amber-800';
const CALCULATED_BADGE = 'bg-emerald-100 text-emerald-800';

export default function CostConfigPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Configuración de costeo</h1>
      <p className="mt-2 text-sm text-muted">
        Porcentajes y rubros usados para calcular el costo de cada evento. Todo acá es{' '}
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${EDITABLE_BADGE}`}>
          editable
        </span>{' '}
        — el resultado del costeo por evento se calcula solo a partir de esto.
      </p>

      <PercentagesForm />
      <SupplyCategoriesSection />
      <ServiceCostCategoriesSection />
      <FixedCostCategoriesSection />
    </main>
  );
}

function PercentagesForm() {
  const { data, isLoading } = useCostConfig();
  const mutation = useUpdateCostConfig();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<TenantCostConfigInput>({
    resolver: zodResolver(TenantCostConfigInputSchema),
    values: data?.config,
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values, { onSuccess: (res) => reset(res.config) });
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted">Cargando…</p>;

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-5"
    >
      <PctField label="Ganancia" field="gananciaPct" register={register} />
      <PctField label="Rotura" field="roturaPct" register={register} />
      <PctField label="IVA" field="ivaPct" register={register} />
      <PctField label="Renegociación" field="insumoRenegotiationPct" register={register} />
      <PctField label="Tope de seña" field="advanceDepositCapPct" register={register} />
      <button
        type="submit"
        disabled={isSubmitting || !isDirty}
        className="col-span-2 self-end rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 sm:col-span-1"
      >
        Guardar
      </button>
    </form>
  );
}

function PctField({
  label,
  field,
  register,
}: {
  label: string;
  field: keyof TenantCostConfigInput;
  register: ReturnType<typeof useForm<TenantCostConfigInput>>['register'];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className={`w-fit rounded px-1.5 py-0.5 text-xs font-semibold ${EDITABLE_BADGE}`}>
        {label}
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        className={`rounded-lg border border-line px-3 py-2 outline-none focus:border-ink`}
        {...register(field, { valueAsNumber: true })}
      />
    </label>
  );
}

function SupplyCategoriesSection() {
  const { data } = useSupplyCategories();
  const create = useCreateSupplyCategory();
  const remove = useDeleteSupplyCategory();
  const { register, handleSubmit, reset } = useForm<SupplyCategoryInput>({
    resolver: zodResolver(SupplyCategoryInputSchema),
    defaultValues: { sortOrder: 0 },
  });

  const onSubmit = handleSubmit((values) => create.mutate(values, { onSuccess: () => reset() }));

  return (
    <CatalogSection title="Rubros de insumos">
      <ul className="flex flex-col gap-1.5">
        {data?.categories.map((category) => (
          <CatalogRow
            key={category.id}
            name={category.name}
            onDelete={() => remove.mutate(category.id)}
          />
        ))}
      </ul>
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          placeholder="Nuevo rubro (ej. Verdulería)"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          {...register('name')}
        />
        <AddButton />
      </form>
    </CatalogSection>
  );
}

function ServiceCostCategoriesSection() {
  const { data } = useServiceCostCategories();
  const create = useCreateServiceCostCategory();
  const remove = useDeleteServiceCostCategory();
  const { register, handleSubmit, reset } = useForm<ServiceCostCategoryInput>({
    resolver: zodResolver(ServiceCostCategoryInputSchema),
  });

  const onSubmit = handleSubmit((values) => create.mutate(values, { onSuccess: () => reset() }));

  return (
    <CatalogSection title="Rubros de gasto de servicio">
      <ul className="flex flex-col gap-1.5">
        {data?.categories.map((category) => (
          <CatalogRow
            key={category.id}
            name={category.name}
            onDelete={() => remove.mutate(category.id)}
          />
        ))}
      </ul>
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          placeholder="Nuevo rubro (ej. DJ)"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          {...register('name')}
        />
        <AddButton />
      </form>
    </CatalogSection>
  );
}

function FixedCostCategoriesSection() {
  const { data } = useFixedCostCategories();
  const create = useCreateFixedCostCategory();
  const remove = useDeleteFixedCostCategory();
  const { register, handleSubmit, reset } = useForm<FixedCostCategoryInput>({
    resolver: zodResolver(FixedCostCategoryInputSchema),
    defaultValues: { guestScaled: false },
  });
  const [showForm, setShowForm] = useState(false);

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, { onSuccess: () => reset({ guestScaled: false }) }),
  );

  return (
    <CatalogSection title="Gastos fijos de salón">
      <ul className="flex flex-col gap-1.5">
        {data?.categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
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
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${CALCULATED_BADGE}`}>
                {formatCurrency(category.monthlyAmount)}/mes
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(category.id)}
                className="text-muted hover:text-red-600"
              >
                Quitar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {showForm ? (
        <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            placeholder="Nombre (ej. Alquiler)"
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
            {...register('name')}
          />
          <input
            type="number"
            step="0.01"
            placeholder="$ por mes"
            className="w-32 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
            {...register('monthlyAmount', { valueAsNumber: true })}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" {...register('guestScaled')} />
            cada 100 invitados
          </label>
          <AddButton />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 text-sm text-gold hover:underline"
        >
          + Agregar gasto fijo
        </button>
      )}
    </CatalogSection>
  );
}

function CatalogSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function CatalogRow({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
      <span>{name}</span>
      <button type="button" onClick={onDelete} className="text-muted hover:text-red-600">
        Quitar
      </button>
    </li>
  );
}

function AddButton() {
  return (
    <button
      type="submit"
      className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
    >
      Agregar
    </button>
  );
}
