import { useState } from 'react';
import { useEventHistory } from '../../../hooks/usePhase4';
import { AuditEntryList } from '../../../components/AuditEntryList';

/** "Historial" del evento (Fase 4): su parte del registro de auditoría. */
export function EventHistorySection({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useEventHistory(eventId);
  return (
    <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">Historial</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted underline hover:text-ink"
        >
          {open ? 'Ocultar' : `Ver (${data?.entries.length ?? 0}${data?.nextCursor ? '+' : ''})`}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Quién cambió qué y cuándo: datos del evento, ajustes de tarjetas, pagos, costeo, personal y
        contrato.
      </p>
      {open && (
        <div className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted">Cargando…</p>
          ) : (
            <AuditEntryList entries={data?.entries ?? []} />
          )}
        </div>
      )}
    </div>
  );
}
