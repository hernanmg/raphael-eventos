// Tipos de las respuestas del portal cliente, compartidos entre apps/api
// (los arma) y apps/web (los consume). No son schemas Zod porque el backend
// los genera él mismo — no hay input de usuario que validar acá, a
// diferencia de auth.ts.

import type { AccountRole, CardType, EventStatus, EventType } from './enums';

export interface CardSummary {
  id: string;
  cardType: CardType;
  quantity: number;
  /** Valor unitario ya actualizado por IPC (no el baseValue histórico) —
   *  el que pagan las tarjetas todavía impagas. */
  unitValue: number;
  /** Pagas a su valor congelado + impagas a `unitValue`. */
  subtotal: number;
  /** Unidades de este tipo ya cubiertas por algún pago con asignación
   *  explícita (ver PaymentAllocationSummary). Desde 2026-10-23 una tarjeta
   *  paga queda CONGELADA al valor del día del pago: deja de indexar por IPC.
   *  `quantity - quantityPaid` = unidades pendientes. */
  quantityPaid: number;
  /** Suma de las pagas a su valor congelado. */
  paidValue: number;
  /** Mes desde el que indexa el valor (alta o último ajuste manual), ISO. */
  basePeriod: string;
}

/**
 * Mínimo de invitados contratado (15/boda/empresarial): si las tarjetas
 * cargadas no llegan al mínimo, lo que falta se cobra a valor Adulto. Cuentan
 * adultos, adolescentes y menores (no brindis). En egreso el mínimo es del
 * evento entero y no se le carga a ninguna familia: solo informativo.
 */
export interface MinimumCharge {
  minGuests: number;
  guestCount: number;
  missing: number;
  unitValue: number;
  subtotal: number;
}

export interface PaymentAllocationSummary {
  cardType: CardType;
  quantity: number;
  /** Valor por tarjeta congelado al registrar el pago. */
  unitValue: number;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  paymentDate: string;
  note: string | null;
  allocations: PaymentAllocationSummary[];
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
    minimumCharge: MinimumCharge | null;
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
