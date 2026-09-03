// Tipos de las respuestas del portal cliente, compartidos entre apps/api
// (los arma) y apps/web (los consume). No son schemas Zod porque el backend
// los genera él mismo — no hay input de usuario que validar acá, a
// diferencia de auth.ts.

import type { AccountRole, CardType, EventStatus, EventType } from './enums';

export interface CardSummary {
  id: string;
  cardType: CardType;
  quantity: number;
  /** Valor unitario ya actualizado por IPC (no el baseValue histórico). */
  unitValue: number;
  subtotal: number;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  paymentDate: string;
  note: string | null;
}

/**
 * "own" = el viewer ve el desglose de un beneficiary puntual (titular de
 * QUINCE/BODA/EMPRESARIAL, o participante de un alumno en EGRESO).
 * "aggregate" = titular de EGRESO: solo totales del evento, nunca el detalle
 * de cada familia.
 */
export type EventAccessScope = 'own' | 'aggregate';

export interface EventSummary {
  eventId: string;
  type: EventType;
  name: string;
  eventDate: string | null;
  status: EventStatus;
  role: AccountRole;
  scope: EventAccessScope;
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
  minGuests: number | null;
  /** Solo presente con scope "aggregate". */
  beneficiaryCount?: number;
}

export interface EventDetail {
  eventId: string;
  type: EventType;
  name: string;
  eventDate: string | null;
  status: EventStatus;
  role: AccountRole;
  scope: EventAccessScope;
  minGuests: number | null;
  own?: {
    label: string | null;
    cards: CardSummary[];
    payments: PaymentSummary[];
    totalValue: number;
    totalPaid: number;
    saldo: number;
    percentPaid: number;
  };
  aggregate?: {
    beneficiaryCount: number;
    totalValue: number;
    totalPaid: number;
    saldo: number;
    percentPaid: number;
  };
}
