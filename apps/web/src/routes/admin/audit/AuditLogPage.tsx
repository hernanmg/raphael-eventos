import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AUDIT_AREAS } from '@raphael-eventos/shared';
import { useAuditLog } from '../../../hooks/usePhase4';
import { AuditEntryList } from '../../../components/AuditEntryList';

/**
 * Registro de auditoría (Fase 4): quién hizo qué cambio y cuándo, sobre lo
 * que importa trazar (tarjetas, pagos, IPC, costeo, personal, eventos,
 * contratos). Solo lectura — la tabla es append-only en la base.
 */
export default function AuditLogPage() {
  const [area, setArea] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors[cursors.length - 1];

  // `to` inclusive: hasta el final de ese día.
  const toExclusive = to
    ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString()
    : undefined;
  const { data, isLoading, isError } = useAuditLog({
    area: area || undefined,
    actor: actor.trim() || undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: toExclusive,
    cursor,
  });

  const resetPaging = () => setCursors([]);
  const field = 'rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink';

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Auditoría</h1>
      <p className="mt-2 text-sm text-muted">
        Quién cambió qué y cuándo: tarjetas, pagos (incluidas las bajas), IPC, costeo, personal,
        eventos y contratos. El registro no se puede editar ni borrar.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Área</span>
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              resetPaging();
            }}
            className={field}
          >
            <option value="">Todas</option>
            {Object.entries(AUDIT_AREAS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Usuario</span>
          <input
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              resetPaging();
            }}
            placeholder="Nombre o email"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetPaging();
            }}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetPaging();
            }}
            className={field}
          />
        </label>
      </div>

      <div className="mt-6">
        {isLoading && <p className="text-sm text-muted">Cargando…</p>}
        {isError && <p className="text-sm text-red-600">No pudimos cargar la auditoría.</p>}
        {data && <AuditEntryList entries={data.entries} />}
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        {cursors.length > 0 && (
          <button
            type="button"
            onClick={() => setCursors((c) => c.slice(0, -1))}
            className="text-muted underline hover:text-ink"
          >
            ← Más recientes
          </button>
        )}
        {data?.nextCursor && (
          <button
            type="button"
            onClick={() => setCursors((c) => [...c, data.nextCursor!])}
            className="text-muted underline hover:text-ink"
          >
            Más antiguos →
          </button>
        )}
      </div>
    </main>
  );
}
