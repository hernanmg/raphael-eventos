import { useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { CardHistoryPanel } from './events/CardHistoryPanel';
import { CancelEventSection } from './events/CancelEventSection';
import { AddCardTypeSection } from './events/AddCardTypeSection';
import { ipcUpdateNote } from '../../lib/ipc';
import { EventHistorySection } from './events/EventHistorySection';
import { EventCostingSection } from './costing/EventCostingSection';
import { EventStaffSection } from './staff/EventStaffSection';
import { AdminGuestsSection } from './guests/AdminGuestsSection';
import { AdminContractSection } from './contracts/AdminContractSection';
import { BeneficiaryPaymentsSection } from './payments/BeneficiaryPaymentsSection';
import { AdminPageNav } from '../../components/admin/AdminPageNav';

export default function AdminEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading, isError } = useAdminEventDetail(eventId);
  const { data: session } = useSession();
  const [adjustingCardId, setAdjustingCardId] = useState<string | null>(null);
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);
  const ipcNote = data
    ? ipcUpdateNote(
        data.event.latestIpcPeriod,
        data.event.beneficiaries.flatMap((b) => b.cards.map((c) => c.basePeriod)),
      )
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <AdminPageNav />

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

          {data.event.status === 'CANCELADO' && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">
                Evento cancelado
                {data.event.cancelledAt && ` el ${formatDate(data.event.cancelledAt)}`}
              </p>
              {data.event.cancellationReason && (
                <p className="mt-1">Motivo: {data.event.cancellationReason}</p>
              )}
              <p className="mt-1">
                Cobrado {formatCurrency(data.event.totals.totalPaid)} · Devuelto{' '}
                {formatCurrency(data.event.refundAmount ?? 0)} · Quedó para el salón{' '}
                {formatCurrency(data.event.totals.totalPaid - (data.event.refundAmount ?? 0))}
              </p>
            </div>
          )}

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

          <div className="flex flex-wrap items-start gap-3">
            <EventEditSection event={data.event} />
            <CancelEventSection event={data.event} />
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

          <h2 className="mt-8 font-serif text-xl font-semibold">
            {data.event.beneficiaries.length > 1
              ? `Alumnos (${data.event.beneficiaries.length})`
              : 'Tarjetas'}
          </h2>
          {ipcNote && (
            <div className="mb-3 mt-1 text-xs text-muted">
              <p>
                {ipcNote.current} {ipcNote.next}
              </p>
              {ipcNote.notYet && <p className="mt-0.5">{ipcNote.notYet}</p>}
              <p className="mt-0.5">
                Las tarjetas pagas quedan fijas al valor del día del pago: tocá “Pagas” para ver el
                detalle.
              </p>
            </div>
          )}

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
                        <th className="py-1 pr-2">Valor impagas</th>
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
                            <button
                              type="button"
                              title="Ver qué pagos las cubren y cómo cambió el valor"
                              onClick={() =>
                                setHistoryCardId(historyCardId === card.id ? null : card.id)
                              }
                              className={`underline decoration-dotted underline-offset-2 hover:text-ink ${
                                card.quantity > 0 && card.quantityPaid >= card.quantity
                                  ? 'text-emerald-700'
                                  : 'text-muted'
                              }`}
                            >
                              {card.quantityPaid} / {card.quantity}
                            </button>
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
                      {beneficiary.minimumCharge && beneficiary.minimumCharge.missing > 0 && (
                        <tr className="border-t border-line text-amber-900">
                          <td className="py-1.5 pr-2" colSpan={3}>
                            Faltan {beneficiary.minimumCharge.missing} para el mínimo de{' '}
                            {beneficiary.minimumCharge.minGuests}
                            <span className="block text-xs text-muted">
                              {beneficiary.minimumCharge.guestCount} cargados (sin contar brindis) ·
                              a valor Adulto
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">
                            {formatCurrency(beneficiary.minimumCharge.unitValue)}
                          </td>
                          <td className="py-1.5 pr-2 font-medium">
                            {formatCurrency(beneficiary.minimumCharge.subtotal)}
                          </td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                {beneficiary.cards
                  .filter((card) => card.id === historyCardId)
                  .map((card) => (
                    <div key={card.id} className="mt-2">
                      <CardHistoryPanel cardId={card.id} onClose={() => setHistoryCardId(null)} />
                    </div>
                  ))}
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
          <AddCardTypeSection event={data.event} />

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
