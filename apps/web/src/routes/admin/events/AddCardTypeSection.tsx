import { useState } from 'react';
import {
  AddCardTypeSchema,
  CardTypeSchema,
  type AdminEventDetail,
  type CardType,
} from '@raphael-eventos/shared';
import { useAddCardType } from '../../../hooks/usePhase4';
import { errorText } from '../../../lib/guestLinks';
import { CARD_TYPE_LABELS } from '../../../lib/format';

/**
 * "Agregar tipo de tarjeta" (feedback 2026-10-23: el evento real se había
 * creado sin Menores). Ofrece solo los tipos que le faltan al evento; en
 * egreso se agrega a cada alumno con la misma cantidad y valor.
 */
export function AddCardTypeSection({ event }: { event: AdminEventDetail }) {
  const missing = CardTypeSchema.options.filter((type) =>
    event.beneficiaries.some((b) => !b.cards.some((c) => c.cardType === type)),
  );
  const [open, setOpen] = useState(false);
  const [cardType, setCardType] = useState<CardType | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [localError, setLocalError] = useState<string>();
  const add = useAddCardType(event.id);

  if (missing.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setCardType(missing[0] ?? '');
          setOpen(true);
        }}
        className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-cream-2"
      >
        + Agregar tipo de tarjeta
      </button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = AddCardTypeSchema.safeParse({
      cardType,
      quantity: quantity || 0,
      unitValue: unitValue.replace(',', '.') || 0,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message);
      return;
    }
    setLocalError(undefined);
    add.mutate(parsed.data, {
      onSuccess: () => {
        setOpen(false);
        setQuantity('');
        setUnitValue('');
      },
    });
  };

  const field =
    'w-full min-w-0 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink';
  return (
    <form
      noValidate
      onSubmit={submit}
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5"
    >
      <p className="font-serif text-lg font-semibold">Agregar tipo de tarjeta</p>
      <p className="text-xs text-muted">
        {event.beneficiaries.length > 1
          ? 'Se agrega a cada alumno que no la tenga, con la misma cantidad y valor. '
          : ''}
        Cantidad y valor pueden quedar en 0 y completarse después con “Ajustar”. El valor sigue
        actualizándose por IPC desde este mes.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Tipo</span>
          <select
            value={cardType}
            onChange={(e) => setCardType(e.target.value as CardType)}
            className={field}
          >
            {missing.map((type) => (
              <option key={type} value={type}>
                {CARD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Cantidad (opcional)</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Valor por tarjeta</span>
          <input
            inputMode="decimal"
            value={unitValue}
            onChange={(e) => setUnitValue(e.target.value)}
            placeholder="$ 0"
            className={field}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={add.isPending}
          className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {add.isPending ? 'Agregando…' : 'Agregar'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-ink"
        >
          Volver
        </button>
        {(localError || add.error) && (
          <span className="text-xs text-red-600">{localError ?? errorText(add.error)}</span>
        )}
      </div>
    </form>
  );
}
