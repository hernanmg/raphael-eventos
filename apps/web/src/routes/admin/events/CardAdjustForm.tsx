import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CardAdjustmentSchema,
  type CardAdjustmentInput,
  type CardSummary,
} from '@raphael-eventos/shared';
import { useAdjustCard } from '../../../hooks/usePhase4';
import { errorText } from '../../../lib/guestLinks';
import { CARD_TYPE_LABELS, formatCurrency } from '../../../lib/format';

/**
 * Ajuste MANUAL de una tarjeta (renegociación) — Fase 4. No es una edición
 * suelta: queda registrado con su motivo y el antes/después, y la tarjeta
 * sigue actualizándose por IPC desde el valor nuevo.
 */
export function CardAdjustForm({
  eventId,
  card,
  onDone,
}: {
  eventId: string;
  card: CardSummary;
  onDone: () => void;
}) {
  const adjust = useAdjustCard(eventId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CardAdjustmentInput>({
    resolver: zodResolver(CardAdjustmentSchema),
    defaultValues: { quantity: card.quantity, unitValue: card.unitValue, reason: '' },
  });
  const field =
    'rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-ink';

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) =>
        adjust.mutate({ cardId: card.id, input }, { onSuccess: onDone }),
      )}
      className="flex flex-col gap-2 rounded-xl bg-cream p-3"
    >
      <p className="text-xs font-semibold text-ink">
        Ajuste manual — {CARD_TYPE_LABELS[card.cardType]} (hoy {card.quantity} ×{' '}
        {formatCurrency(card.unitValue)})
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[100px_160px_1fr]">
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted">Cantidad</span>
          <input
            type="number"
            min={card.quantityPaid}
            className={field}
            {...register('quantity')}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted">Valor vigente desde hoy</span>
          <input type="number" step="0.01" className={field} {...register('unitValue')} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-[11px] sm:col-span-1">
          <span className="text-muted">Motivo (obligatorio)</span>
          <input
            placeholder="Ej.: renegociación por cambio de menú"
            className={field}
            {...register('reason')}
          />
        </label>
      </div>
      {(errors.quantity || errors.unitValue || errors.reason) && (
        <p className="text-xs text-red-600">
          {errors.reason?.message ?? errors.unitValue?.message ?? errors.quantity?.message}
        </p>
      )}
      <p className="text-[11px] text-muted">
        Queda registrado en el historial como ajuste manual (distinto del ajuste automático por
        IPC), y desde hoy el valor nuevo sigue actualizándose por IPC.
        {card.quantityPaid > 0 &&
          ` La cantidad no puede bajar de ${card.quantityPaid} (ya asignadas a pagos).`}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={adjust.isPending}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Guardar ajuste
        </button>
        <button type="button" onClick={onDone} className="text-xs text-muted hover:text-ink">
          Cancelar
        </button>
        {adjust.error && <span className="text-xs text-red-600">{errorText(adjust.error)}</span>}
      </div>
    </form>
  );
}
