import { useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { CreateEventSchema, type CreateEventInput } from '@raphael-eventos/shared';
import { useCreateEvent } from '../../hooks/useAdmin';
import { api, ApiError } from '../../lib/api';
import { FormField } from '../../components/FormField';
import { CARD_TYPE_LABELS, EVENT_TYPE_LABELS } from '../../lib/format';

const EVENT_TYPES = ['QUINCE', 'EGRESO', 'BODA', 'EMPRESARIAL'] as const;
const CARD_TYPES = ['ADULTO', 'ADOLESCENTE', 'MENOR', 'BRINDIS'] as const;

const DEFAULT_VALUES: CreateEventInput = {
  type: 'QUINCE',
  name: '',
  eventDate: undefined,
  titularName: undefined,
  titularEmail: '',
  minGuests: undefined,
  cards: CARD_TYPES.map((cardType) => ({ cardType, quantity: 0, baseValue: 0 })),
  alumnos: [],
};

export default function CreateEventPage() {
  const navigate = useNavigate();
  const mutation = useCreateEvent();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'alumnos' });
  const type = watch('type');
  const isEgreso = type === 'EGRESO';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRowErrors, setImportRowErrors] = useState<{ row: number; error: string }[]>([]);

  async function handleDownloadTemplate() {
    const blob = await api.downloadAlumnosTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-alumnos.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportRowErrors([]);
    try {
      const { rows } = await api.importAlumnos(file);
      replace(
        rows.map((row) => ({
          label: row.label,
          contactEmail: row.contactEmail || undefined,
          contactPhone: row.contactPhone || undefined,
        })),
      );
      setImportRowErrors(
        rows.filter((row) => row.error).map((row) => ({ row: row.row, error: row.error! })),
      );
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'No pudimos leer el archivo');
    } finally {
      setImporting(false);
    }
  }

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => navigate('/admin'),
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : 'No pudimos crear el evento';
        setError('root', { message });
      },
    });
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Cargar evento</h1>
      <p className="mt-2 text-sm text-muted">
        El email del titular es lo que vincula el evento a la cuenta del cliente — si ya tiene
        cuenta, queda vinculado al instante; si no, en cuanto se registre con ese mismo email.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6" noValidate>
        <div>
          <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-ink">
            Tipo de evento
          </label>
          <select id="type" {...register('type')} className="field-input">
            {EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {EVENT_TYPE_LABELS[eventType]}
              </option>
            ))}
          </select>
        </div>

        <FormField label="Nombre del evento" error={errors.name?.message} {...register('name')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Fecha (opcional)"
            type="date"
            error={errors.eventDate?.message}
            {...register('eventDate')}
          />
          {isEgreso && (
            <FormField
              label="Mínimo de invitados (opcional)"
              type="number"
              min={0}
              error={errors.minGuests?.message}
              {...register('minGuests')}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={
              isEgreso ? 'Nombre del colegio/comisión (opcional)' : 'Nombre del titular (opcional)'
            }
            error={errors.titularName?.message}
            {...register('titularName')}
          />
          <FormField
            label={isEgreso ? 'Email del colegio/comisión' : 'Email del titular'}
            type="email"
            error={errors.titularEmail?.message}
            {...register('titularEmail')}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            Tarjetas {isEgreso ? '(mismo valor para cada alumno)' : ''}
          </legend>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Cantidad</th>
                  <th className="px-4 py-2.5">Valor base</th>
                </tr>
              </thead>
              <tbody>
                {CARD_TYPES.map((cardType, index) => (
                  <tr key={cardType} className="border-t border-line">
                    <td className="px-4 py-2.5">{CARD_TYPE_LABELS[cardType]}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        className="field-input"
                        {...register(`cards.${index}.quantity`)}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="field-input"
                        {...register(`cards.${index}.baseValue`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.cards?.message && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {errors.cards.message}
            </p>
          )}
        </fieldset>

        {isEgreso && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Alumnos</legend>

            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-gold hover:underline"
              >
                Descargar plantilla
              </button>
              <span className="text-muted">·</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="text-gold hover:underline disabled:opacity-60"
              >
                {importing ? 'Importando…' : 'Importar desde Excel'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleImportFile}
                className="hidden"
              />
              {importError && <span className="text-red-600">{importError}</span>}
            </div>
            {importRowErrors.length > 0 && (
              <p className="mb-3 text-sm text-amber-700">
                Revisá estas filas antes de guardar:{' '}
                {importRowErrors.map((r) => `fila ${r.row} (${r.error})`).join(', ')}.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-line p-3"
                >
                  <div className="flex-1">
                    <FormField
                      label="Nombre"
                      error={errors.alumnos?.[index]?.label?.message}
                      {...register(`alumnos.${index}.label`)}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      label="Email (opcional)"
                      type="email"
                      error={errors.alumnos?.[index]?.contactEmail?.message}
                      {...register(`alumnos.${index}.contactEmail`)}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      label="Teléfono (opcional)"
                      error={errors.alumnos?.[index]?.contactPhone?.message}
                      {...register(`alumnos.${index}.contactPhone`)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="mt-6 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-red-400 hover:text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            {errors.alumnos?.message && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {errors.alumnos.message}
              </p>
            )}
            <button
              type="button"
              onClick={() =>
                append({ label: '', contactEmail: undefined, contactPhone: undefined })
              }
              className="mt-3 rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              + Agregar alumno
            </button>
          </fieldset>
        )}

        {errors.root?.message && (
          <p role="alert" className="text-sm text-red-600">
            {errors.root.message}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            {mutation.isPending ? 'Guardando…' : 'Crear evento'}
          </button>
          <Link
            to="/admin"
            className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-muted transition hover:border-ink hover:text-ink"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
