import { Link, useParams } from 'react-router-dom';
import type { EventDetail } from '@raphael-eventos/shared';
import { useEventDetail } from '../../hooks/useEvents';
import { PortalContractLink } from './PortalContractLink';
import { PortalGuestsSection } from './PortalGuestsSection';
import {
  ACCOUNT_ROLE_LABELS,
  CARD_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  formatCurrency,
  formatDate,
} from '../../lib/format';

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading, isError } = useEventDetail(eventId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/portal" className="text-sm text-muted hover:text-ink">
        ← Mis eventos
      </Link>

      {isLoading && <p className="mt-6 text-sm text-muted">Cargando el evento…</p>}

      {isError && (
        <p className="mt-6 text-sm text-red-600">
          No encontramos ese evento, o no tenés acceso a verlo.
        </p>
      )}

      {data && (
        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gold">
            {EVENT_TYPE_LABELS[data.event.type]}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold">{data.event.name}</h1>
            <span className="rounded-full bg-cream-2 px-3 py-1 text-xs font-semibold text-ink">
              {ACCOUNT_ROLE_LABELS[data.event.role]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{formatDate(data.event.eventDate)}</p>
          <PortalContractLink eventId={data.event.eventId} />

          {data.event.scope === 'own' && data.event.own && <OwnEventDetail own={data.event.own} />}

          {data.event.scope === 'aggregate' && data.event.aggregate && (
            <AggregateEventDetail
              aggregate={data.event.aggregate}
              minGuests={data.event.minGuests}
            />
          )}

          <PortalGuestsSection eventId={data.event.eventId} />
        </div>
      )}
    </main>
  );
}

function TotalsSummary({
  totalValue,
  totalPaid,
  saldo,
  percentPaid,
}: {
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
}) {
  const progress = Math.min(100, Math.max(0, percentPaid));

  return (
    <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total (valor actual)" value={formatCurrency(totalValue)} />
        <Stat label="Abonado" value={formatCurrency(totalPaid)} />
        <Stat label="Saldo pendiente" value={formatCurrency(saldo)} emphasis />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cream-2">
        <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">{percentPaid}% abonado</p>
    </div>
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

function OwnEventDetail({ own }: { own: NonNullable<EventDetail['own']> }) {
  return (
    <>
      {own.label && <p className="mt-3 text-sm text-muted">Alumno/a: {own.label}</p>}

      <TotalsSummary
        totalValue={own.totalValue}
        totalPaid={own.totalPaid}
        saldo={own.saldo}
        percentPaid={own.percentPaid}
      />

      <h2 className="mb-3 mt-8 font-serif text-xl font-semibold">Tarjetas</h2>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Pagas</th>
              <th className="px-4 py-3">Valor actual (c/u)</th>
              <th className="px-4 py-3">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {own.cards.map((card) => (
              <tr key={card.id} className="border-t border-line">
                <td className="px-4 py-3">{CARD_TYPE_LABELS[card.cardType]}</td>
                <td className="px-4 py-3">{card.quantity}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      card.quantityPaid >= card.quantity ? 'text-emerald-700' : 'text-muted'
                    }
                  >
                    {card.quantityPaid} / {card.quantity}
                  </span>
                </td>
                <td className="px-4 py-3">{formatCurrency(card.unitValue)}</td>
                <td className="px-4 py-3 font-medium">{formatCurrency(card.subtotal)}</td>
              </tr>
            ))}
            {own.cards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Todavía no hay tarjetas cargadas para este evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        El valor de cada tarjeta se actualiza automáticamente por IPC — el que ves acá es el vigente
        hoy, no el que se fijó al contratar.
      </p>

      <h2 className="mb-3 mt-8 font-serif text-xl font-semibold">Pagos</h2>
      {own.payments.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay pagos registrados.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {own.payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{formatDate(payment.paymentDate)}</p>
                {payment.note && <p className="text-xs text-muted">{payment.note}</p>}
              </div>
              <span className="font-semibold text-ink">{formatCurrency(payment.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AggregateEventDetail({
  aggregate,
  minGuests,
}: {
  aggregate: NonNullable<EventDetail['aggregate']>;
  minGuests: number | null;
}) {
  return (
    <>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Como titular de este evento ves el total general — el detalle de pago de cada familia queda
        privado.
      </p>

      <TotalsSummary
        totalValue={aggregate.totalValue}
        totalPaid={aggregate.totalPaid}
        saldo={aggregate.saldo}
        percentPaid={aggregate.percentPaid}
      />

      <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
        {/* Cantidad de alumnos (beneficiaries) — el avance real de invitados
            confirmados vive en PortalGuestsSection. */}
        <p className="text-xs uppercase tracking-wide text-muted">Alumnos</p>
        <p className="mt-1 text-lg font-semibold text-ink">{aggregate.beneficiaryCount}</p>
        {minGuests !== null && (
          <p className="mt-1 text-xs text-muted">Mínimo de invitados contratado: {minGuests}</p>
        )}
      </div>
    </>
  );
}
