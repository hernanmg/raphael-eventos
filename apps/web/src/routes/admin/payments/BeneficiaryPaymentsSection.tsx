import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RecordPaymentSchema,
  type CardSummary,
  type CardType,
  type PaymentSummary,
  type RecordPaymentInput,
} from '@raphael-eventos/shared';
import { useDeletePayment, useRecordPayment } from '../../../hooks/useAdmin';
import { ApiError } from '../../../lib/api';
import { CARD_TYPE_LABELS, formatCurrency, formatDate } from '../../../lib/format';

export function BeneficiaryPaymentsSection({
  eventId,
  beneficiaryId,
  payments,
  cards,
}: {
  eventId: string;
  beneficiaryId: string;
  payments: PaymentSummary[];
  cards: CardSummary[];
}) {
  const record = useRecordPayment(eventId);
  const remove = useDeletePayment(eventId);
  const [warning, setWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllocations, setShowAllocations] = useState(false);
  const [allocationQty, setAllocationQty] = useState<Partial<Record<CardType, number>>>({});
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<RecordPaymentInput>({ resolver: zodResolver(RecordPaymentSchema) });

  const pendingCards = cards.filter((card) => card.quantity - card.quantityPaid > 0);

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const allocations = Object.entries(allocationQty)
      .filter(([, quantity]) => (quantity ?? 0) > 0)
      .map(([cardType, quantity]) => ({ cardType: cardType as CardType, quantity: quantity! }));

    record.mutate(
      { beneficiaryId, input: { ...values, allocations } },
      {
        onSuccess: (result) => {
          reset();
          setAllocationQty({});
          setWarning(result.advanceDepositWarning);
        },
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : 'No pudimos registrar el pago');
        },
      },
    );
  });

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pagos</p>
        <Link
          to={`/admin/beneficiarios/${beneficiaryId}/reporte`}
          target="_blank"
          className="text-xs text-gold hover:underline"
        >
          Ver reporte
        </Link>
      </div>

      {payments.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {payments.map((payment) => (
            <li key={payment.id} className="text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {formatDate(payment.paymentDate)}
                  {payment.note && <span className="text-muted"> — {payment.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ink">{formatCurrency(payment.amount)}</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(payment.id)}
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Quitar
                  </button>
                </span>
              </div>
              {payment.allocations.length > 0 && (
                <p className="text-xs text-muted">
                  Cubre:{' '}
                  {payment.allocations
                    .map((a) => `${a.quantity} ${CARD_TYPE_LABELS[a.cardType]}`)
                    .join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {warning && (
        <p className="mt-2 text-xs text-amber-700">
          Este pago supera el tope de seña anticipada configurado — es solo informativo, se registró
          igual.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Monto"
            className="w-28 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-ink"
            {...register('amount', { valueAsNumber: true })}
          />
          <input
            type="date"
            className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-ink"
            {...register('paymentDate')}
          />
          <input
            placeholder="Nota (opcional)"
            className="w-36 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-ink"
            {...register('note')}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            Registrar pago
          </button>
        </div>

        {pendingCards.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAllocations((v) => !v)}
              className="text-xs text-gold hover:underline"
            >
              {showAllocations ? 'Ocultar' : '¿Este pago cubre tarjetas puntuales?'}
            </button>
            {showAllocations && (
              <div className="mt-1.5 flex flex-wrap gap-3">
                {pendingCards.map((card) => (
                  <label key={card.cardType} className="flex items-center gap-1.5 text-xs">
                    {CARD_TYPE_LABELS[card.cardType]} (faltan {card.quantity - card.quantityPaid}):
                    <input
                      type="number"
                      min={0}
                      max={card.quantity - card.quantityPaid}
                      value={allocationQty[card.cardType] ?? ''}
                      onChange={(e) =>
                        setAllocationQty((prev) => ({
                          ...prev,
                          [card.cardType]: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      className="w-14 rounded border border-line px-1.5 py-1 text-xs outline-none focus:border-ink"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
