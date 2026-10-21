import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { CreateIpcEntrySchema, type CreateIpcEntryInput } from '@raphael-eventos/shared';
import { useAddIpcEntry, useIpcHistory } from '../../hooks/useAdmin';
import { ApiError } from '../../lib/api';
import { FormField } from '../../components/FormField';
import { formatTimestamp } from '../../lib/format';
import {
  accumulatedByEntry,
  formatPeriod,
  formatPeriodMonth,
  formatVariation,
} from '../../lib/ipc';
import { AdminPageNav } from '../../components/admin/AdminPageNav';
import { IpcVariationChart } from '../../components/admin/IpcVariationChart';

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
      onSuccess: () => reset({ period: '', variationPct: undefined }),
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : 'No pudimos cargar el mes';
        setError('root', { message });
      },
    });
  });

  const history = useMemo(() => data?.history ?? [], [data]);
  const accumulated = useMemo(() => accumulatedByEntry(history), [history]);
  const latest = history[0];
  const latestAccumulated = latest ? accumulated.get(latest.id) : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <AdminPageNav />
      <h1 className="mt-4 font-serif text-3xl font-semibold">Estado del IPC</h1>
      <p className="mt-2 text-sm text-muted">
        La inflación de cada mes (IPC del INDEC) se trae sola desde datos.gob.ar y actualiza el
        valor de las tarjetas. Si algún mes no llega, cargalo acá a mano.{' '}
        <Link to="/ayuda#admin-ipc" className="underline hover:text-ink">
          ¿Cómo actualiza las tarjetas?
        </Link>
      </p>

      {data?.staleness.stale && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {data.staleness.message}
        </div>
      )}

      {latest && (
        <div className="mt-6 rounded-2xl border border-line bg-paper p-5 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted">
            Inflación de {formatPeriod(latest.period)}
          </p>
          <p className="mt-1 font-serif text-4xl font-semibold text-ink tabular-nums">
            {formatVariation(latest.sourceLatestValue)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted">
                Acumulado {new Date(latest.period).getUTCFullYear()}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {latestAccumulated?.yearToDate != null
                  ? formatVariation(latestAccumulated.yearToDate)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Últimos 12 meses</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {latestAccumulated?.last12Months != null
                  ? formatVariation(latestAccumulated.last12Months)
                  : '—'}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            {latest.triggeredByName
              ? `Cargado a mano por ${latest.triggeredByName}`
              : 'Traído automáticamente'}{' '}
            el {formatTimestamp(latest.fetchedAt)}
          </p>
        </div>
      )}

      <IpcVariationChart history={history} />

      <form
        onSubmit={onSubmit}
        className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5"
      >
        <div>
          <h2 className="font-serif text-lg font-semibold">Cargar un mes a mano</h2>
          <p className="mt-1 text-xs text-muted">
            Solo si el dato no llegó solo. Usá el % que publica el INDEC para ese mes (ej. 1,66). Si
            el mes ya estaba cargado, se reemplaza.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* type="date" y no "month": Firefox y Safari de escritorio no tienen selector
              de mes. Cualquier día sirve, el server lo lleva al día 1. */}
          <FormField
            label="Mes (cualquier día)"
            type="date"
            error={errors.period?.message}
            {...register('period')}
          />
          <FormField
            label="% de variación del mes"
            type="number"
            step="0.01"
            inputMode="decimal"
            error={errors.variationPct?.message}
            {...register('variationPct')}
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
          {mutation.isPending ? 'Guardando…' : 'Cargar mes'}
        </button>
      </form>

      <h2 className="mb-3 mt-10 font-serif text-xl font-semibold">Historial</h2>
      {isLoading && <p className="text-sm text-muted">Cargando…</p>}
      {isError && <p className="text-sm text-red-600">No pudimos cargar el historial.</p>}
      {data && history.length === 0 && (
        <p className="text-sm text-muted">Todavía no se cargó ningún mes.</p>
      )}
      {history.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Mes</th>
                  <th className="px-4 py-2.5 text-right">Variación</th>
                  <th className="px-4 py-2.5 text-right">Acum. del año</th>
                  <th className="px-4 py-2.5">Origen</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const ytd = accumulated.get(entry.id)?.yearToDate;
                  return (
                    <tr key={entry.id} className="border-t border-line">
                      <td className="whitespace-nowrap px-4 py-2.5 first-letter:uppercase">
                        {formatPeriod(entry.period)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {formatVariation(entry.sourceLatestValue)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted tabular-nums">
                        {ytd != null ? formatVariation(ytd) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {entry.triggeredByName ? `A mano · ${entry.triggeredByName}` : 'Automático'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details className="group mt-4 rounded-2xl border border-line bg-paper">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm text-muted hover:text-ink">
              <span className="group-open:hidden">Ver índice técnico</span>
              <span className="hidden group-open:inline">Ocultar índice técnico</span>
            </summary>
            <div className="border-t border-line px-5 pb-5 pt-4 text-sm">
              <p className="text-muted">
                Para calcular las tarjetas, la app encadena las variaciones en un índice interno que
                arrancó en 100 (el 100 es arbitrario, solo importa la proporción entre dos meses).
                Valor actual de una tarjeta = valor cargado × índice de{' '}
                {formatPeriodMonth(latest!.period)} ÷ índice del mes en que se cargó.
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2">Mes</th>
                      <th className="px-4 py-2 text-right">Índice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-4 py-2 first-letter:uppercase">
                          {formatPeriod(entry.period)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {entry.indexValue.toFixed(2).replace('.', ',')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </>
      )}
    </main>
  );
}
