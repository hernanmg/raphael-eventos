import type { CardSummary } from '@raphael-eventos/shared';
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
  baseValue: Prisma.Decimal;
  basePeriod: Date;
};
export type PaymentRow = {
  id: string;
  amount: Prisma.Decimal;
  paymentDate: Date;
  note: string | null;
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

export function serializeCard(card: CardRow, ipcRows: IpcRow[]): CardSummary {
  const factor = indexFactor(ipcRows, card.basePeriod);
  const unitValue = round2(Number(card.baseValue) * factor);
  return {
    id: card.id,
    cardType: card.cardType as CardSummary['cardType'],
    quantity: card.quantity,
    unitValue,
    subtotal: round2(unitValue * card.quantity),
  };
}

export interface BeneficiaryFinancials {
  cards: CardSummary[];
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
}

export function computeBeneficiaryFinancials(
  beneficiary: { cards: CardRow[]; payments: PaymentRow[] },
  ipcRows: IpcRow[],
): BeneficiaryFinancials {
  const cards = beneficiary.cards.map((card) => serializeCard(card, ipcRows));
  const totalValue = round2(cards.reduce((sum, card) => sum + card.subtotal, 0));
  const totalPaid = round2(
    beneficiary.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
  );
  return {
    cards,
    totalValue,
    totalPaid,
    saldo: round2(totalValue - totalPaid),
    percentPaid: percentPaid(totalPaid, totalValue),
  };
}

export function computeAggregateFinancials(
  beneficiaries: { cards: CardRow[]; payments: PaymentRow[] }[],
  ipcRows: IpcRow[],
) {
  let totalValue = 0;
  let totalPaid = 0;
  for (const beneficiary of beneficiaries) {
    const financials = computeBeneficiaryFinancials(beneficiary, ipcRows);
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
