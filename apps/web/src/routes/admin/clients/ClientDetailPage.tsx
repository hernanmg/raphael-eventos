import { Link, useParams } from 'react-router-dom';
import { useClientDetail } from '../../../hooks/useAdmin';
import { ACCOUNT_ROLE_LABELS, EVENT_TYPE_LABELS, formatCurrency } from '../../../lib/format';

export default function ClientDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading, isError } = useClientDetail(userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin/clientes" className="text-sm text-muted hover:text-ink">
        ← Clientes
      </Link>

      {isLoading && <p className="mt-6 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-6 text-sm text-red-600">No encontramos ese cliente.</p>}

      {data && (
        <div className="mt-4">
          <h1 className="font-serif text-3xl font-semibold">{data.client.fullName}</h1>
          <p className="mt-1 text-sm text-muted">
            {data.client.email}
            {data.client.phone && ` · ${data.client.phone}`}
          </p>

          <h2 className="mb-3 mt-8 font-serif text-xl font-semibold">
            Eventos ({data.client.events.length})
          </h2>

          {data.client.events.length === 0 ? (
            <p className="text-sm text-muted">Este cliente no tiene eventos vinculados todavía.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.client.events.map((event) => (
                <Link
                  key={event.eventAccountId}
                  to={`/admin/eventos/${event.eventId}`}
                  className="block rounded-2xl border border-line p-4 transition hover:border-ink"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </span>
                      <p className="font-medium text-ink">{event.eventName}</p>
                      <p className="text-xs text-muted">
                        {ACCOUNT_ROLE_LABELS[event.role]}
                        {event.scope === 'aggregate' && ' · ve solo el agregado del evento'}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted">
                        Abonado {formatCurrency(event.totalPaid)} de{' '}
                        {formatCurrency(event.totalValue)}
                      </p>
                      <p className="font-semibold text-ink">Saldo {formatCurrency(event.saldo)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
