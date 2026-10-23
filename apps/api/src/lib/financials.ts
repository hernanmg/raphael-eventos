import type { CardSummary, MinimumCharge, PaymentSummary } from '@raphael-eventos/shared';
import type { Prisma } from '@prisma/client';

// Cálculo de tarjetas/saldo actualizado por IPC — usado tanto por el portal
// cliente (portal.service.ts, con las reglas de privacidad "own"/"aggregate")
// como por el panel admin (admin.service.ts, que ve todo sin restricción).
// Vive acá para no duplicar la lógica entre los dos.

export type IpcRow = { period: Date; indexValue: Prisma.Decimal };
export type CardRow = {
  id: string;
  cardType: string;
  quantity: number;
  baseValue: Prisma.Decimal | number;
  basePeriod: Date;
};
export type AllocationRow = {
  cardType: string;
  quantity: number;
  unitValue: Prisma.Decimal | number;
};
export type PaymentRow = {
  id: string;
  amount: Prisma.Decimal;
  paymentDate: Date;
  note: string | null;
  allocations?: AllocationRow[];
};

function round2(n: number): number {
  return Number(n.toFixed(2));
}

export function percentPaid(totalPaid: number, totalValue: number): number {
  return totalValue > 0 ? Number(((totalPaid / totalValue) * 100).toFixed(1)) : 0;
}

/**
 * Factor a aplicar sobre baseValue: índice vigente (el período más reciente
 * cargado) / índice en basePeriod (el período con período <= basePeriod más
 * cercano, o el primero disponible si basePeriod es anterior a todo lo
 * cargado). Sin ningún IpcIndexValue todavía (fresh install, el cron nunca
 * corrió) el factor es 1 — se muestra el valor base tal cual, no se rompe la
 * pantalla del cliente.
 */
export function indexFactor(ipcRows: IpcRow[], basePeriod: Date): number {
  if (ipcRows.length === 0) return 1;
  const latest = ipcRows[ipcRows.length - 1]!;
  const baseRow =
    [...ipcRows].reverse().find((row) => row.period.getTime() <= basePeriod.getTime()) ??
    ipcRows[0]!;
  return Number(latest.indexValue) / Number(baseRow.indexValue);
}

export type PaidByType = Map<string, { quantity: number; value: number }>;

/** Unidades pagas por tipo y su valor congelado (Σ cantidad × valor del día del pago). */
export function paidByType(payments: PaymentRow[]): PaidByType {
  const map: PaidByType = new Map();
  for (const payment of payments) {
    for (const allocation of payment.allocations ?? []) {
      const entry = map.get(allocation.cardType) ?? { quantity: 0, value: 0 };
      entry.quantity += allocation.quantity;
      entry.value += allocation.quantity * Number(allocation.unitValue);
      map.set(allocation.cardType, entry);
    }
  }
  return map;
}

/** Valor unitario vigente (IPC) de una tarjeta. */
export function currentUnitValue(card: CardRow, ipcRows: IpcRow[]): number {
  return round2(Number(card.baseValue) * indexFactor(ipcRows, card.basePeriod));
}

/**
 * Tarjeta con su valor: las pagas (asignadas a pagos) quedan CONGELADAS al
 * valor del día en que se pagaron — decisión 2026-10-23; antes todas
 * indexaban y un mes con inflación agregaba deuda sobre tarjetas ya pagas —
 * y solo las impagas valen `unitValue` (actualizado por IPC).
 */
export function serializeCard(
  card: CardRow,
  ipcRows: IpcRow[],
  paid: { quantity: number; value: number } = { quantity: 0, value: 0 },
): CardSummary {
  const unitValue = currentUnitValue(card, ipcRows);
  const quantityPaid = Math.min(paid.quantity, card.quantity);
  return {
    id: card.id,
    cardType: card.cardType as CardSummary['cardType'],
    quantity: card.quantity,
    unitValue,
    subtotal: round2(paid.value + (card.quantity - quantityPaid) * unitValue),
    quantityPaid,
    paidValue: round2(paid.value),
    basePeriod: card.basePeriod.toISOString(),
  };
}

/** Tipos que cuentan para el mínimo de invitados (el brindis no). */
const MINIMUM_CARD_TYPES = new Set(['ADULTO', 'ADOLESCENTE', 'MENOR']);

/**
 * Mínimo contratado de 15/boda/empresarial: lo que falte para llegar a
 * `minGuests` se cobra a valor Adulto vigente (o, sin tarjeta adulto con
 * valor, al mayor valor cargado). null si el evento no tiene mínimo. En
 * egreso no se llama: el mínimo es del evento, no de cada familia.
 */
export function minimumChargeFor(
  cards: CardSummary[],
  minGuests: number | null | undefined,
): MinimumCharge | null {
  if (!minGuests || minGuests <= 0) return null;
  const guestCount = cards
    .filter((card) => MINIMUM_CARD_TYPES.has(card.cardType))
    .reduce((sum, card) => sum + card.quantity, 0);
  const missing = Math.max(minGuests - guestCount, 0);
  const adult = cards.find((card) => card.cardType === 'ADULTO' && card.unitValue > 0);
  const unitValue = adult?.unitValue ?? Math.max(0, ...cards.map((card) => card.unitValue));
  return { minGuests, guestCount, missing, unitValue, subtotal: round2(missing * unitValue) };
}

/** El mínimo que se cobra al beneficiary: solo eventos de un único beneficiary. */
export function chargeableMinimum(event: { type: string; minGuests: number | null }) {
  return event.type === 'EGRESO' ? null : event.minGuests;
}

export function serializePayment(payment: PaymentRow): PaymentSummary {
  return {
    id: payment.id,
    amount: Number(payment.amount),
    paymentDate: payment.paymentDate.toISOString(),
    note: payment.note,
    allocations: (payment.allocations ?? []).map((allocation) => ({
      cardType: allocation.cardType as PaymentSummary['allocations'][number]['cardType'],
      quantity: allocation.quantity,
      unitValue: Number(allocation.unitValue),
    })),
  };
}

export interface BeneficiaryFinancials {
  cards: CardSummary[];
  minimumCharge: MinimumCharge | null;
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
}

/**
 * `minGuests`: el mínimo cobrable del evento (`chargeableMinimum(event)`) —
 * null en egreso o si no tiene mínimo.
 */
export function computeBeneficiaryFinancials(
  beneficiary: { cards: CardRow[]; payments: PaymentRow[] },
  ipcRows: IpcRow[],
  minGuests: number | null = null,
): BeneficiaryFinancials {
  const paid = paidByType(beneficiary.payments);
  const cards = beneficiary.cards.map((card) =>
    serializeCard(card, ipcRows, paid.get(card.cardType)),
  );
  const minimumCharge = minimumChargeFor(cards, minGuests);
  const totalValue = round2(
    cards.reduce((sum, card) => sum + card.subtotal, 0) + (minimumCharge?.subtotal ?? 0),
  );
  const totalPaid = round2(
    beneficiary.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
  );
  return {
    cards,
    minimumCharge,
    totalValue,
    totalPaid,
    saldo: round2(totalValue - totalPaid),
    percentPaid: percentPaid(totalPaid, totalValue),
  };
}

export function computeAggregateFinancials(
  beneficiaries: { cards: CardRow[]; payments: PaymentRow[] }[],
  ipcRows: IpcRow[],
  minGuests: number | null = null,
) {
  let totalValue = 0;
  let totalPaid = 0;
  for (const beneficiary of beneficiaries) {
    const financials = computeBeneficiaryFinancials(beneficiary, ipcRows, minGuests);
    totalValue += financials.totalValue;
    totalPaid += financials.totalPaid;
  }
  totalValue = round2(totalValue);
  totalPaid = round2(totalPaid);
  return {
    beneficiaryCount: beneficiaries.length,
    totalValue,
    totalPaid,
    saldo: round2(totalValue - totalPaid),
    percentPaid: percentPaid(totalPaid, totalValue),
  };
}
