import { useState } from 'react';
import type { AuditLogEntry } from '@raphael-eventos/shared';
import { formatDateTime } from '../lib/format';

const ACTION_STYLES: Record<AuditLogEntry['action'], string> = {
  CREATE: 'bg-emerald-50 text-emerald-800',
  UPDATE: 'bg-cream-2 text-ink',
  DELETE: 'bg-red-50 text-red-700',
};

const ACTION_LABELS: Record<AuditLogEntry['action'], string> = {
  CREATE: 'Alta',
  UPDATE: 'Cambio',
  DELETE: 'Baja',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** `changes` puede ser {campo: {de, a}} (cambio) o un snapshot plano (alta/baja). */
function ChangesView({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== 'object') return null;
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-cream p-2 text-[11px]">
      {Object.entries(changes as Record<string, unknown>).map(([field, value]) => {
        const isDiff = value !== null && typeof value === 'object' && 'de' in value && 'a' in value;
        return (
          <div key={field} className="contents">
            <dt className="text-muted">{field}</dt>
            <dd className="break-all text-ink">
              {isDiff ? (
                <>
                  <span className="text-muted line-through">
                    {formatValue((value as { de: unknown }).de)}
                  </span>{' '}
                  → {formatValue((value as { a: unknown }).a)}
                </>
              ) : (
                formatValue(value)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Lista de entradas de auditoría — compartida por /admin/auditoria y el historial de evento. */
export function AuditEntryList({ entries }: { entries: AuditLogEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (entries.length === 0) {
    return <p className="text-sm text-muted">Sin movimientos registrados.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-line px-3 py-2 text-sm">
          <button
            type="button"
            onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
            className="flex w-full flex-wrap items-center gap-2 text-left"
            aria-expanded={openId === entry.id}
          >
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_STYLES[entry.action]}`}
            >
              {ACTION_LABELS[entry.action]}
            </span>
            <span className="flex-1 text-ink">{entry.summary}</span>
            <span className="text-[11px] text-muted">
              {formatDateTime(entry.createdAt)} · {entry.actorLabel}
            </span>
          </button>
          {openId === entry.id && <ChangesView changes={entry.changes} />}
        </li>
      ))}
    </ul>
  );
}
