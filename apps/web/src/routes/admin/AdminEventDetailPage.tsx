import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminEventDetail } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import {
  CARD_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  formatCurrency,
  formatDate,
} from '../../lib/format';
import { EventEditSection } from './events/EventEditSection';
import { CardAdjustForm } from './events/CardAdjustForm';
import { EventHistorySection } from './events/EventHistorySection';
import { EventCostingSection } from './costing/EventCostingSection';
import { EventStaffSection } from './staff/EventStaffSection';
import { AdminGuestsSection } from './guests/AdminGuestsSection';
import { AdminContractSection } from './contracts/AdminContractSection';
import { BeneficiaryPaymentsSection } from './payments/BeneficiaryPaymentsSection';

export default function AdminEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading, isError } = useAdminEventDetail(eventId);
  const { data: session } = useSession();
  const [adjustingCardId, setAdjustingCardId] = useState<string | null>(null);

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
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold">{data.event.name}</h1>
            {data.event.status !== 'ACTIVO' && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  data.event.status === 'CANCELADO'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-cream-2 text-ink'
                }`}
              >
                {EVENT_STATUS_LABELS[data.event.status]}
              </span>
            )}
          </div>
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
            {data.event.titularPhone && (
              <p>
                <span className="text-muted">Teléfono: </span>
                {data.event.titularPhone}
              </p>
            )}
            {data.event.soldByEmployeeName && (
              <p>
                <span className="text-muted">Vendido por: </span>
                {data.event.soldByEmployeeName}
                {data.event.soldAt && ` (${formatDate(data.event.soldAt)})`}
              </p>
            )}
            {data.event.minGuests !== null && (
              <p>
                <span className="text-muted">Mínimo de invitados: </span>
                {data.event.minGuests}
              </p>
            )}
          </div>

          <EventEditSection event={data.event} />

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
                        <th className="py-1 pr-2">Pagas</th>
                        <th className="py-1 pr-2">Valor actual</th>
                        <th className="py-1 pr-2">Subtotal</th>
                        <th className="py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {beneficiary.cards.map((card) => (
                        <tr key={card.id} className="border-t border-line">
                          <td className="py-1.5 pr-2">{CARD_TYPE_LABELS[card.cardType]}</td>
                          <td className="py-1.5 pr-2">{card.quantity}</td>
                          <td className="py-1.5 pr-2">
                            <span
                              className={
                                card.quantityPaid >= card.quantity
                                  ? 'text-emerald-700'
                                  : 'text-muted'
                              }
                            >
                              {card.quantityPaid} / {card.quantity}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">{formatCurrency(card.unitValue)}</td>
                          <td className="py-1.5 pr-2 font-medium">
                            {formatCurrency(card.subtotal)}
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setAdjustingCardId(adjustingCardId === card.id ? null : card.id)
                              }
                              className="text-xs text-muted underline hover:text-ink"
                            >
                              Ajustar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {beneficiary.cards
                  .filter((card) => card.id === adjustingCardId)
                  .map((card) => (
                    <div key={card.id} className="mt-2">
                      <CardAdjustForm
                        eventId={data.event.id}
                        card={card}
                        onDone={() => setAdjustingCardId(null)}
                      />
                    </div>
                  ))}

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">
                    Abonado {formatCurrency(beneficiary.totalPaid)} de{' '}
                    {formatCurrency(beneficiary.totalValue)}
                  </span>
                  <span className="font-semibold text-ink">
                    Saldo {formatCurrency(beneficiary.saldo)}
                  </span>
                </div>

                <BeneficiaryPaymentsSection
                  eventId={data.event.id}
                  beneficiaryId={beneficiary.id}
                  payments={beneficiary.payments}
                  cards={beneficiary.cards}
                />
              </div>
            ))}
          </div>

          <AdminGuestsSection
            eventId={data.event.id}
            startTime={data.event.startTime}
            photosUrl={data.event.photosUrl}
          />
          <EventStaffSection eventId={data.event.id} />
          {session?.tenantPlan === 'PRO' && <EventCostingSection eventId={data.event.id} />}
          <AdminContractSection eventId={data.event.id} />
          <EventHistorySection eventId={data.event.id} />
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
