import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { CreateIpcEntrySchema, type CreateIpcEntryInput } from '@raphael-eventos/shared';
import { useAddIpcEntry, useIpcHistory } from '../../hooks/useAdmin';
import { ApiError } from '../../lib/api';
import { FormField } from '../../components/FormField';
import { formatDate } from '../../lib/format';

export default function IpcStatusPage() {
  const { data, isLoading, isError } = useIpcHistory();
  const mutation = useAddIpcEntry();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateIpcEntryInput>({ resolver: zodResolver(CreateIpcEntrySchema) });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => reset(),
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : 'No pudimos cargar el período';
        setError('root', { message });
      },
    });
  });

  const latest = data?.history[0];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Estado del IPC</h1>
      <p className="mt-2 text-sm text-muted">
        El fetch automático contra datos.gob.ar todavía no está construido — mientras tanto, cada
        período se carga acá a mano con los mismos dos valores que usaría el job (último valor
        publicado y el anterior). El índice se encadena sobre el último cargado, nunca se recalcula
        hacia atrás.
      </p>

      {latest && (
        <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Último índice aplicado</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{latest.indexValue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted">
            Período {formatDate(latest.period)}
            {latest.triggeredByName ? ` · cargado por ${latest.triggeredByName}` : ''}
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5"
      >
        <h2 className="font-serif text-lg font-semibold">Cargar un período nuevo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Período"
            type="date"
            error={errors.period?.message}
            {...register('period')}
          />
          <FormField
            label="Valor anterior"
            type="number"
            step="0.01"
            error={errors.sourcePreviousValue?.message}
            {...register('sourcePreviousValue')}
          />
          <FormField
            label="Valor último"
            type="number"
            step="0.01"
            error={errors.sourceLatestValue?.message}
            {...register('sourceLatestValue')}
          />
        </div>
        {errors.root?.message && (
          <p role="alert" className="text-sm text-red-600">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {mutation.isPending ? 'Guardando…' : 'Cargar período'}
        </button>
      </form>

      <h2 className="mb-3 mt-10 font-serif text-xl font-semibold">Historial</h2>
      {isLoading && <p className="text-sm text-muted">Cargando…</p>}
      {isError && <p className="text-sm text-red-600">No pudimos cargar el historial.</p>}
      {data && data.history.length === 0 && (
        <p className="text-sm text-muted">Todavía no se cargó ningún período.</p>
      )}
      {data && data.history.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Período</th>
                <th className="px-4 py-2.5">Índice</th>
                <th className="px-4 py-2.5">Valores fuente</th>
                <th className="px-4 py-2.5">Cargado</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-4 py-2.5">{formatDate(entry.period)}</td>
                  <td className="px-4 py-2.5 font-medium">{entry.indexValue.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {entry.sourcePreviousValue} → {entry.sourceLatestValue}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {formatDate(entry.fetchedAt)}
                    {entry.triggeredByName ? ` · ${entry.triggeredByName}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
