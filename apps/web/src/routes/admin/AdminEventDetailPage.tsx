import { Link, useParams } from 'react-router-dom';
import { useAdminEventDetail } from '../../hooks/useAdmin';
import { CARD_TYPE_LABELS, EVENT_TYPE_LABELS, formatCurrency, formatDate } from '../../lib/format';

export default function AdminEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading, isError } = useAdminEventDetail(eventId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>

      {isLoading && <p className="mt-6 text-sm text-muted">Cargando el evento…</p>}
      {isError && <p className="mt-6 text-sm text-red-600">No encontramos ese evento.</p>}

      {data && (
        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gold">
            {EVENT_TYPE_LABELS[data.event.type]}
          </span>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{data.event.name}</h1>
          <p className="mt-1 text-sm text-muted">{formatDate(data.event.eventDate)}</p>

          <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted">Titular: </span>
              {data.event.titularName || '—'}
            </p>
            <p>
              <span className="text-muted">Email: </span>
              {data.event.titularEmail || '—'}
            </p>
            {data.event.minGuests !== null && (
              <p>
                <span className="text-muted">Mínimo de invitados: </span>
                {data.event.minGuests}
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-3">
            <Stat
              label="Total (valor actual)"
              value={formatCurrency(data.event.totals.totalValue)}
            />
            <Stat label="Abonado" value={formatCurrency(data.event.totals.totalPaid)} />
            <Stat
              label="Saldo pendiente"
              value={formatCurrency(data.event.totals.saldo)}
              emphasis
            />
          </div>

          <h2 className="mb-3 mt-8 font-serif text-xl font-semibold">
            {data.event.beneficiaries.length > 1
              ? `Alumnos (${data.event.beneficiaries.length})`
              : 'Tarjetas'}
          </h2>

          <div className="flex flex-col gap-4">
            {data.event.beneficiaries.map((beneficiary) => (
              <div key={beneficiary.id} className="rounded-2xl border border-line p-4">
                {beneficiary.label && (
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-ink">{beneficiary.label}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        beneficiary.linked ? 'bg-cream-2 text-ink' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {beneficiary.linked ? 'Cuenta vinculada' : 'Sin vincular todavía'}
                    </span>
                  </div>
                )}
                {beneficiary.contactEmail && (
                  <p className="mb-2 text-xs text-muted">{beneficiary.contactEmail}</p>
                )}

                {beneficiary.cards.length === 0 ? (
                  <p className="text-sm text-muted">Sin tarjetas cargadas.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="py-1 pr-2">Tipo</th>
                        <th className="py-1 pr-2">Cant.</th>
                        <th className="py-1 pr-2">Valor actual</th>
                        <th className="py-1">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beneficiary.cards.map((card) => (
                        <tr key={card.id} className="border-t border-line">
                          <td className="py-1.5 pr-2">{CARD_TYPE_LABELS[card.cardType]}</td>
                          <td className="py-1.5 pr-2">{card.quantity}</td>
                          <td className="py-1.5 pr-2">{formatCurrency(card.unitValue)}</td>
                          <td className="py-1.5 font-medium">{formatCurrency(card.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">
                    Abonado {formatCurrency(beneficiary.totalPaid)} de{' '}
                    {formatCurrency(beneficiary.totalValue)}
                  </span>
                  <span className="font-semibold text-ink">
                    Saldo {formatCurrency(beneficiary.saldo)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${emphasis ? 'text-ink' : 'text-ink/80'}`}>
        {value}
      </p>
    </div>
  );
}
