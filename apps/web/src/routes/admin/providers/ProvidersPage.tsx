import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ProviderInputSchema,
  type AdminProvider,
  type AdminSponsor,
  type EventType,
  type ProviderInput,
} from '@raphael-eventos/shared';
import {
  useAdminProviders,
  useAdminSponsors,
  useDeleteProvider,
  useDeleteSponsor,
  useSaveProvider,
  useSaveSponsor,
} from '../../../hooks/usePhase4';
import { EVENT_TYPE_LABELS } from '../../../lib/format';
import { errorText } from '../../../lib/guestLinks';
import { apiUrl } from '../../../lib/api';

const EMPTY_PROVIDER: ProviderInput = {
  name: '',
  category: '',
  description: '',
  contactName: '',
  phone: '',
  email: '',
  instagramUrl: '',
  websiteUrl: '',
  eventTypes: [],
  referralPct: undefined,
  referralNote: '',
  active: true,
  sortOrder: 0,
};

function toForm(p: AdminProvider): ProviderInput {
  return {
    name: p.name,
    category: p.category,
    description: p.description ?? '',
    contactName: p.contactName ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    instagramUrl: p.instagramUrl ?? '',
    websiteUrl: p.websiteUrl ?? '',
    eventTypes: p.eventTypes,
    referralPct: p.referralPct ?? undefined,
    referralNote: p.referralNote ?? '',
    active: p.active,
    sortOrder: p.sortOrder,
  };
}

/**
 * Directorio de proveedores aliados + sponsors de la landing (Fase 4, Plan
 * Básica). La comisión de referencia es solo una nota interna: no mueve
 * dinero y no se muestra nunca en la landing ni en el portal.
 */
export default function ProvidersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Proveedores y sponsors</h1>
      <p className="mt-2 text-sm text-muted">
        Los proveedores activos se muestran en la landing y en el portal de cada cliente, filtrados
        por el tipo de evento. La comisión de referencia es solo para uso interno.
      </p>
      <ProvidersSection />
      <SponsorsSection />
    </main>
  );
}

function ProvidersSection() {
  const { data } = useAdminProviders();
  const save = useSaveProvider();
  const remove = useDeleteProvider();
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProviderInput>({
    resolver: zodResolver(ProviderInputSchema),
    defaultValues: EMPTY_PROVIDER,
  });

  const categories = [...new Set((data?.providers ?? []).map((p) => p.category))];
  const field = 'rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink';

  const startEdit = (provider: AdminProvider) => {
    setEditingId(provider.id);
    reset(toForm(provider));
  };
  const cancelEdit = () => {
    setEditingId(null);
    reset(EMPTY_PROVIDER);
  };

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-semibold">Proveedores</h2>

      {data && data.providers.length === 0 && (
        <p className="mt-2 text-sm text-muted">Todavía no hay proveedores cargados.</p>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {data?.providers.map((p) => (
          <li
            key={p.id}
            className={`rounded-2xl border border-line p-4 ${p.active ? '' : 'opacity-60'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink">
                  {p.name}
                  <span className="ml-2 text-xs text-muted">{p.category}</span>
                  {!p.active && (
                    <span className="ml-2 rounded-full bg-cream-2 px-2 py-0.5 text-[10px] font-semibold">
                      Oculto
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {p.eventTypes.map((t) => EVENT_TYPE_LABELS[t]).join(' · ')}
                  {p.phone && ` · ${p.phone}`}
                </p>
                {(p.referralPct !== null || p.referralNote) && (
                  <p className="mt-1 text-xs text-gold">
                    Referencia interna: {p.referralPct !== null && `${p.referralPct}%`}{' '}
                    {p.referralNote}
                  </p>
                )}
              </div>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="text-muted underline hover:text-ink"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Borrar a ${p.name} del directorio?`)) remove.mutate(p.id);
                  }}
                  className="text-muted hover:text-red-600"
                >
                  Borrar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <form
        noValidate
        onSubmit={handleSubmit((input) =>
          save.mutate({ id: editingId, input }, { onSuccess: cancelEdit }),
        )}
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5"
      >
        <p className="font-serif text-lg font-semibold">
          {editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Nombre</span>
            <input className={field} {...register('name')} />
            {errors.name && <span className="text-red-600">{errors.name.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Rubro</span>
            <input
              list="provider-categories"
              placeholder="Fotógrafo, decoración, sonido…"
              className={field}
              {...register('category')}
            />
            <datalist id="provider-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {errors.category && <span className="text-red-600">{errors.category.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium text-ink">Descripción (opcional)</span>
            <input className={field} {...register('description')} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Contacto (opcional)</span>
            <input className={field} {...register('contactName')} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Teléfono / WhatsApp (opcional)</span>
            <input type="tel" className={field} {...register('phone')} />
            {errors.phone && <span className="text-red-600">{errors.phone.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Email (opcional)</span>
            <input type="email" className={field} {...register('email')} />
            {errors.email && <span className="text-red-600">{errors.email.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Instagram (link, opcional)</span>
            <input type="url" className={field} {...register('instagramUrl')} />
            {errors.instagramUrl && (
              <span className="text-red-600">{errors.instagramUrl.message}</span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Web (link, opcional)</span>
            <input type="url" className={field} {...register('websiteUrl')} />
            {errors.websiteUrl && <span className="text-red-600">{errors.websiteUrl.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Orden (menor = primero)</span>
            <input type="number" min={0} className={field} {...register('sortOrder')} />
          </label>
        </div>
        <fieldset className="flex flex-col gap-1 text-xs">
          <legend className="mb-1 font-medium text-ink">Tipos de evento</legend>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
              <label key={type} className="flex items-center gap-1.5">
                <input type="checkbox" value={type} {...register('eventTypes')} />
                {EVENT_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
          {errors.eventTypes && <span className="text-red-600">{errors.eventTypes.message}</span>}
        </fieldset>
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-cream p-3 sm:grid-cols-[140px_1fr]">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Comisión ref. (%)</span>
            <input
              type="number"
              step="0.5"
              min={0}
              max={100}
              className={field}
              {...register('referralPct')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">Nota interna (opcional)</span>
            <input className={field} {...register('referralNote')} />
          </label>
          <p className="text-[11px] text-muted sm:col-span-2">
            Solo referencia para el salón: no genera ningún cobro y no se muestra en la landing ni
            en el portal.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" {...register('active')} />
          Visible en la landing y el portal
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {editingId ? 'Guardar cambios' : 'Agregar proveedor'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-muted hover:text-ink"
            >
              Cancelar
            </button>
          )}
          {save.error && <span className="text-xs text-red-600">{errorText(save.error)}</span>}
        </div>
      </form>
    </section>
  );
}

function SponsorsSection() {
  const { data } = useAdminSponsors();
  const save = useSaveSponsor();
  const remove = useDeleteSponsor();
  const [editing, setEditing] = useState<AdminSponsor | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set('active', String(form.get('active') === 'on'));
    const logo = form.get('logo');
    if (logo instanceof File && logo.size === 0) form.delete('logo');
    save.mutate(
      { id: editing?.id ?? null, form },
      {
        onSuccess: () => {
          setEditing(null);
          formRef.current?.reset();
        },
      },
    );
  };

  const field = 'rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink';

  return (
    <section className="mt-12">
      <h2 className="font-serif text-xl font-semibold">Sponsors de la landing</h2>
      <p className="mt-1 text-sm text-muted">Logo + link, en una franja al final de la landing.</p>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data?.sponsors.map((s) => (
          <li
            key={s.id}
            className={`flex flex-col items-center gap-2 rounded-2xl border border-line p-3 text-center ${
              s.active ? '' : 'opacity-60'
            }`}
          >
            <img
              // Ruta del panel (sirve también sponsors ocultos), con el mismo ?v= de versión.
              src={apiUrl(s.logoPath.replace('/public/', '/admin/'))}
              alt={s.name}
              className="h-14 w-full object-contain"
            />
            <p className="text-xs font-medium text-ink">
              {s.name}
              {!s.active && ' (oculto)'}
            </p>
            <div className="flex gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => setEditing(s)}
                className="text-muted underline hover:text-ink"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Borrar el sponsor ${s.name}?`)) remove.mutate(s.id);
                }}
                className="text-muted hover:text-red-600"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        key={editing?.id ?? 'new'}
        onSubmit={onSubmit}
        className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-2"
      >
        <p className="font-serif text-lg font-semibold sm:col-span-2">
          {editing ? `Editar sponsor: ${editing.name}` : 'Nuevo sponsor'}
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Nombre</span>
          <input name="name" required defaultValue={editing?.name} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Link (opcional)</span>
          <input
            name="linkUrl"
            type="url"
            defaultValue={editing?.linkUrl ?? ''}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">
            Logo (PNG, JPG o WEBP, hasta 1 MB){editing && ' — vacío = mantener el actual'}
          </span>
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required={!editing}
            className="text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Orden</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={editing?.sortOrder ?? 0}
            className={field}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input name="active" type="checkbox" defaultChecked={editing?.active ?? true} />
          Visible en la landing
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {editing ? 'Guardar cambios' : 'Agregar sponsor'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs text-muted hover:text-ink"
            >
              Cancelar
            </button>
          )}
          {save.error && <span className="text-xs text-red-600">{errorText(save.error)}</span>}
        </div>
      </form>
    </section>
  );
}
