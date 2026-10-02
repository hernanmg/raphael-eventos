import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ReminderConfigInputSchema, type ReminderConfigInput } from '@raphael-eventos/shared';
import {
  useReminderConfig,
  useReminderLogs,
  useRunReminders,
  useUpdateReminderConfig,
} from '../../../hooks/useReminders';
import { formatDate } from '../../../lib/format';

const STATUS_LABELS: Record<string, string> = {
  SENT: 'Enviado',
  FAILED: 'Falló',
  SKIPPED: 'Omitido',
};

export default function RemindersPage() {
  const { data: configData } = useReminderConfig();
  const updateConfig = useUpdateReminderConfig();
  const { data: logsData, isLoading: logsLoading } = useReminderLogs();
  const run = useRunReminders();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<ReminderConfigInput>({
    resolver: zodResolver(ReminderConfigInputSchema),
    values: configData?.config,
  });

  const onSubmit = handleSubmit((values) => {
    updateConfig.mutate(values, { onSuccess: (res) => reset(res.config) });
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Recordatorios automáticos</h1>
      <p className="mt-2 text-sm text-muted">
        Cadencia fija: recuerda por WhatsApp mientras haya saldo pendiente, y con más urgencia cerca
        de la fecha del evento. <strong>Todavía no hay WhatsApp Business API conectado</strong> — el
        barrido corre igual y queda en el log de abajo qué mensaje le tocaba a quién, útil para
        mandarlo a mano mientras tanto.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5"
      >
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" {...register('enabled')} />
          Recordatorios habilitados (barrido diario automático)
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">
              Recordar cada (días) si hay saldo pendiente
            </span>
            <input
              type="number"
              min={1}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('cadenceDaysIfPendingBalance', { valueAsNumber: true })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">
              Recordar si faltan (días) para el evento y no está saldado
            </span>
            <input
              type="number"
              min={0}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('daysBeforeEventIfUnpaid', { valueAsNumber: true })}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => run.mutate()}
            disabled={run.isPending}
            className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white disabled:opacity-60"
          >
            {run.isPending ? 'Enviando…' : 'Enviar ahora'}
          </button>
          {run.data && (
            <span className="text-xs text-muted">
              {run.data.result.checked} revisados · {run.data.result.sent} enviados ·{' '}
              {run.data.result.failed} fallaron · {run.data.result.skipped} omitidos
            </span>
          )}
        </div>
      </form>

      <h2 className="mb-3 mt-10 font-serif text-xl font-semibold">Log</h2>
      {logsLoading && <p className="text-sm text-muted">Cargando…</p>}
      {logsData && logsData.logs.length === 0 && (
        <p className="text-sm text-muted">Todavía no se corrió ningún barrido.</p>
      )}
      <div className="flex flex-col gap-2">
        {logsData?.logs.map((log) => (
          <div key={log.id} className="rounded-xl border border-line p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">
                {log.beneficiaryLabel} — {log.eventName}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  log.status === 'SENT'
                    ? 'bg-emerald-100 text-emerald-800'
                    : log.status === 'FAILED'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {STATUS_LABELS[log.status]}
              </span>
            </div>
            <p className="mt-1 text-muted">{log.message}</p>
            {log.errorMessage && <p className="mt-1 text-xs text-red-600">{log.errorMessage}</p>}
            <p className="mt-1 text-xs text-muted">
              {formatDate(log.sentAt)} · {log.trigger === 'MANUAL' ? 'manual' : 'automático'}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
