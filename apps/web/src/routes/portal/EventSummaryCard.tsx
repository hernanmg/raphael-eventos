import { Link } from 'react-router-dom';
import type { EventSummary } from '@raphael-eventos/shared';
import {
  ACCOUNT_ROLE_LABELS,
  EVENT_TYPE_LABELS,
  formatCurrency,
  formatDate,
} from '../../lib/format';

export function EventSummaryCard({ event }: { event: EventSummary }) {
  const progress = Math.min(100, Math.max(0, event.percentPaid));

  return (
    <Link
      to={`/portal/eventos/${event.eventId}`}
      className="block rounded-2xl border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(20,20,20,.06)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gold">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <h3 className="font-serif text-lg font-semibold text-ink">{event.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{formatDate(event.eventDate)}</p>
        </div>
        <span className="rounded-full bg-cream-2 px-3 py-1 text-xs font-semibold text-ink">
          {ACCOUNT_ROLE_LABELS[event.role]}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">Saldo pendiente</span>
        <span className="font-semibold text-ink">{formatCurrency(event.saldo)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-2">
        <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">{event.percentPaid}% abonado</p>
    </Link>
  );
}
