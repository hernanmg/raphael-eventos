import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LeadStatus, LeadSummary } from '@raphael-eventos/shared';
import { useLeads, useUpdateLead } from '../../../hooks/useCrm';
import {
  EVENT_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  formatDate,
  formatTimestamp,
} from '../../../lib/format';

const STATUS_ORDER: LeadStatus[] = ['NUEVO', 'CONTACTADO', 'CON_SENA', 'GANADO', 'PERDIDO'];

export default function LeadsPage() {
  const [filter, setFilter] = useState<LeadStatus | undefined>(undefined);
  const { data, isLoading, isError } = useLeads(filter);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Consultas</h1>
      <p className="mt-2 text-sm text-muted">
        Leads que llegan desde el formulario de cotización de la landing, más las que se cargan a
        mano acá. Una consulta "con seña" reserva tentativamente su fecha en el{' '}
        <Link to="/admin/calendario" className="underline hover:text-ink">
          calendario de disponibilidad
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip
          label="Todas"
          active={filter === undefined}
          onClick={() => setFilter(undefined)}
        />
        {STATUS_ORDER.map((status) => (
          <FilterChip
            key={status}
            label={LEAD_STATUS_LABELS[status]}
            active={filter === status}
            onClick={() => setFilter(status)}
          />
        ))}
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar las consultas.</p>}
      {data && data.leads.length === 0 && (
        <p className="mt-8 text-sm text-muted">No hay consultas para mostrar acá.</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {data?.leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </main>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-ink'
      }`}
    >
      {label}
    </button>
  );
}

function LeadCard({ lead }: { lead: LeadSummary }) {
  const update = useUpdateLead();
  const [notes, setNotes] = useState(lead.notes ?? '');

  function handleStatusChange(status: LeadStatus) {
    update.mutate({
      id: lead.id,
      input: {
        status,
        notes: notes || undefined,
        interestedDate: lead.interestedDate ?? undefined,
      },
    });
  }

  function handleNotesBlur() {
    if (notes === (lead.notes ?? '')) return;
    update.mutate({
      id: lead.id,
      input: {
        status: lead.status,
        notes: notes || undefined,
        interestedDate: lead.interestedDate ?? undefined,
      },
    });
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gold">
            {EVENT_TYPE_LABELS[lead.eventType]}
          </span>
          <p className="font-medium text-ink">{lead.fullName}</p>
          <p className="text-xs text-muted">
            {lead.phone}
            {lead.interestedDate && ` · fecha tentativa ${formatDate(lead.interestedDate)}`}
            {' · '}
            {formatTimestamp(lead.createdAt)}
          </p>
          {lead.message && <p className="mt-1 text-sm text-ink/80">{lead.message}</p>}
        </div>
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-ink"
        >
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleNotesBlur}
        placeholder="Notas internas…"
        className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
        rows={2}
      />
    </div>
  );
}
