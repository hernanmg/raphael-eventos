import { useState } from 'react';
import { CancelEventSchema, type AdminEventDetail } from '@raphael-eventos/shared';
import { useCancelEvent } from '../../../hooks/usePhase4';
import { errorText } from '../../../lib/guestLinks';
import { formatCurrency } from '../../../lib/format';

/**
 * Baja de un evento (feedback 2026-10-23: un cliente llamó cancelando y el
 * cambio de estado estaba escondido dentro de "Editar evento"). Pide motivo y
 * el monto devuelto (opcional — la seña se pierde). Los pagos quedan como
 * historial; la cobranza de reportes resta la devolución.
 */
export function CancelEventSection({ event }: { event: AdminEventDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState('');
  const [localError, setLocalError] = useState<string>();
  const cancel = useCancelEvent(event.id);

  if (event.status === 'CANCELADO') return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
      >
        Cancelar evento
      </button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CancelEventSchema.safeParse({
      reason,
      refundAmount: refund.replace(',', '.'),
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message);
      return;
    }
    setLocalError(undefined);
    cancel.mutate(parsed.data, { onSuccess: () => setOpen(false) });
  };

  const field = 'rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink';
  return (
    <form
      noValidate
      onSubmit={submit}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/40 p-5"
    >
      <p className="font-serif text-lg font-semibold">Cancelar evento</p>
      <p className="text-xs text-muted">
        Sale del calendario, de los reportes, del micrositio, del check-in y de los recordatorios.
        Los pagos quedan registrados como historial. Cobrado hasta hoy:{' '}
        <strong>{formatCurrency(event.totals.totalPaid)}</strong>.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="font-medium text-ink">Motivo</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. el cliente llamó para cancelar"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Monto devuelto al cliente (opcional)</span>
          <input
            inputMode="decimal"
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            placeholder="$ 0 — la seña no se devuelve"
            className={field}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={cancel.isPending}
          className="rounded-full bg-red-700 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {cancel.isPending ? 'Cancelando…' : 'Confirmar baja'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-ink"
        >
          Volver
        </button>
        {(localError || cancel.error) && (
          <span className="text-xs text-red-600">{localError ?? errorText(cancel.error)}</span>
        )}
      </div>
    </form>
  );
}
