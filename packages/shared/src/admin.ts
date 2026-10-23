// Schemas y tipos del panel admin — alta de eventos y carga de IPC. Los
// schemas de input se comparten (validación de formulario en apps/web +
// validación de payload en apps/api); los tipos de respuesta son interfaces
// planas, igual criterio que portal.ts (el backend genera esos datos él
// mismo, no hay input de usuario que validar ahí).

import { z } from 'zod';
import { CardTypeSchema, EventTypeSchema, EventStatusSchema } from './enums';
import { optionalText } from './zodHelpers';
import type { AccountRole, EventStatus, EventType } from './enums';
import type { CardSummary, MinimumCharge, PaymentSummary } from './portal';

const PaymentAllocationInputSchema = z.object({
  cardType: CardTypeSchema,
  quantity: z.coerce.number().int().min(0).max(9999),
});

/**
 * `allocations` es opcional (ver CLAUDE.md "Fase 2 — asignación de pagos"):
 * un pago rápido puede quedar sin desglosar por tipo de tarjeta — el
 * desglose se usa cuando aporta (ej. una familia de egreso paga por
 * unidades puntuales), no es obligatorio en cada carga.
 */
export const RecordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Tiene que ser mayor a 0'),
  paymentDate: z.string().trim().min(1, 'Elegí la fecha'),
  note: optionalText(z.string().trim().max(200)),
  allocations: z
    .array(PaymentAllocationInputSchema)
    .default([])
    .refine((rows) => rows.every((row) => row.quantity > 0), {
      message: 'Las cantidades asignadas tienen que ser mayores a 0',
    }),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

export interface RecordPaymentResult {
  payment: PaymentSummary;
  /** true si este pago, sumado a los anteriores, supera
   *  TenantCostConfig.advanceDepositCapPct del total del beneficiary — solo
   *  informativo, decisión cerrada de no bloquear nada con esto (ver
   *  CLAUDE.md "Fase 2 — costeo y personal"). */
  advanceDepositWarning: boolean;
}

export const EventCardInputSchema = z.object({
  cardType: CardTypeSchema,
  quantity: z.coerce.number().int().min(0).max(9999),
  baseValue: z.coerce.number().min(0).max(100_000_000),
});
export type EventCardInput = z.infer<typeof EventCardInputSchema>;

export const AlumnoInputSchema = z.object({
  label: z.string().trim().min(1, 'Ingresá el nombre del alumno').max(160),
  contactEmail: optionalText(z.string().trim().toLowerCase().email('Email inválido')),
  contactPhone: optionalText(z.string().trim().min(6).max(30)),
});
export type AlumnoInput = z.infer<typeof AlumnoInputSchema>;

/**
 * Alta de evento. `cards` son las 4 tarjetas (algunas en 0 si no aplican al
 * evento). La cantidad NO es obligatoria (feedback 2026-10-23: al firmar no
 * saben cuántos invitados van a tener): alcanza con el valor, y la cantidad
 * sube sola al asignar pagos. `minGuests` aplica a todos los tipos (default
 * 100 en el form); en 15/boda/empresarial lo que falte se cobra a valor
 * Adulto (ver MinimumCharge). En EGRESO, `cards` es la plantilla que se aplica igual a cada
 * alumno de `alumnos` (simplificación de la Fase 1 — todos los alumnos de un
 * mismo egreso comparten el mismo desglose; ajustar valores por alumno
 * individual queda para más adelante).
 */
export const CreateEventSchema = z
  .object({
    type: EventTypeSchema,
    name: z.string().trim().min(2, 'Ingresá un nombre para el evento').max(160),
    eventDate: optionalText(z.string().trim().min(1)),
    titularName: optionalText(z.string().trim().min(2).max(160)),
    titularEmail: z.string().trim().toLowerCase().email('Email inválido'),
    // optionalText (no z.coerce.number().optional() a secas): un <input
    // type="number"> vacío llega como "", y Number("") da 0 en vez de NaN —
    // sin esto, dejar el campo en blanco guardaba minGuests: 0 en lugar de
    // "no cargado". Mismo bug de fondo que ya se dio con RegisterSchema.phone.
    minGuests: optionalText(z.coerce.number().int().min(0).max(100_000)),
    cards: z.array(EventCardInputSchema).length(4),
    alumnos: z.array(AlumnoInputSchema).default([]),
    /** Empleado que vendió el evento (genera su comisión de venta). */
    soldByEmployeeId: optionalText(z.string().trim().min(1)),
    /** Fecha de la venta (default: hoy) — define el mes de la comisión. */
    soldAt: optionalText(z.string().trim().min(1)),
  })
  .refine((data) => data.cards.some((card) => card.quantity > 0 || card.baseValue > 0), {
    message: 'Cargá el valor de al menos un tipo de tarjeta',
    path: ['cards'],
  })
  .refine((data) => data.type !== 'EGRESO' || data.alumnos.length > 0, {
    message: 'Un egreso necesita al menos un alumno cargado',
    path: ['alumnos'],
  });
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

/**
 * Edición de un evento ya creado (Fase 4). El tipo NO se edita (define la
 * estructura de beneficiaries). Cambiar `titularEmail` re-vincula el portal:
 * el titular viejo pierde acceso, el nuevo lo gana (ver
 * admin.service.ts#updateEvent). `minGuests` aplica a todos los tipos.
 * Para cancelar se usa CancelEventSchema (pide motivo y devolución).
 */
export const UpdateEventSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá un nombre para el evento').max(160),
  eventDate: optionalText(z.string().trim().min(1)),
  titularName: optionalText(z.string().trim().min(2).max(160)),
  titularEmail: z.string().trim().toLowerCase().email('Email inválido'),
  titularPhone: optionalText(z.string().trim().min(6, 'Teléfono inválido').max(30)),
  minGuests: optionalText(z.coerce.number().int().min(0).max(100_000)),
  status: EventStatusSchema,
  soldByEmployeeId: optionalText(z.string().trim().min(1)),
  soldAt: optionalText(z.string().trim().min(1)),
});
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

/**
 * Baja de un evento (feedback 2026-10-23): la seña se pierde; si se devuelve
 * algo de las cuotas, se registra el monto (opcional). Los pagos quedan como
 * historial y la cobranza de reportes resta la devolución.
 */
export const CancelEventSchema = z.object({
  reason: z.string().trim().min(3, 'Contá el motivo de la baja').max(300),
  refundAmount: optionalText(z.coerce.number().min(0, 'No puede ser negativo').max(1_000_000_000)),
});
export type CancelEventInput = z.infer<typeof CancelEventSchema>;

/**
 * Tipos de tarjeta que tiene todo evento (feedback 2026-10-23): se crean al
 * dar de alta aunque estén en 0 (cantidad y valor se completan después con
 * "Ajustar"). Brindis solo si se carga algo.
 */
export const BASE_CARD_TYPES = ['ADULTO', 'ADOLESCENTE', 'MENOR'] as const;

/** "Agregar tipo de tarjeta" a un evento ya creado (en egreso, a cada alumno
 *  que no lo tenga, con la misma cantidad y valor). */
export const AddCardTypeSchema = z.object({
  cardType: CardTypeSchema,
  quantity: z.coerce.number().int().min(0, 'No puede ser negativa').max(100_000),
  unitValue: z.coerce.number().min(0, 'No puede ser negativo').max(1_000_000_000),
});
export type AddCardTypeInput = z.infer<typeof AddCardTypeSchema>;

/**
 * Ajuste MANUAL de una tarjeta (renegociación) — Fase 4. No es un UPDATE
 * suelto: queda un EventCardAdjustment con el antes/después y el motivo, y la
 * tarjeta se re-basa (`unitValue` = valor vigente desde hoy, sigue indexando
 * por IPC desde el período actual).
 */
export const CardAdjustmentSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(100_000),
  /** Valor unitario vigente desde hoy (no el baseValue histórico). */
  unitValue: z.coerce.number().positive('El valor tiene que ser mayor a 0').max(1_000_000_000),
  reason: z.string().trim().min(3, 'Contá el motivo del ajuste').max(300),
});
export type CardAdjustmentInput = z.infer<typeof CardAdjustmentSchema>;

/**
 * `variationPct` = puntos porcentuales de variación intermensual del IPC de
 * ese mes (ej. 2.11 = +2.11%) — el mismo dato que devuelve la serie de
 * datos.gob.ar (145.3_INGNACUAL_DICI_M_38, "Variación intermensual"), no un
 * nivel de índice. Se permiten negativos por si algún mes hay deflación. Se
 * guarda en `sourceLatestValue`; `sourcePreviousValue` lo completa el server
 * con la variación del mes anterior ya guardada (ver admin.service.ts#addIpcEntry).
 */
export const CreateIpcEntrySchema = z.object({
  /** Cualquier día del mes que representa el dato (el server lo lleva al día 1). */
  period: z.string().trim().min(1, 'Elegí el mes'),
  // El <input> vacío llega como "" y z.coerce lo convertiría en 0 (un 0% que
  // nadie cargó): se pasa a undefined para que falle como "falta el dato".
  variationPct: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number({ invalid_type_error: 'Cargá el % de variación' })
      .min(-50, 'Revisá el valor')
      .max(100, 'Revisá el valor'),
  ),
});
export type CreateIpcEntryInput = z.infer<typeof CreateIpcEntrySchema>;

/** Corrección de un mes cargado a mano: solo el %, el mes no cambia (para
 *  cambiar de mes se borra y se carga de nuevo). */
export const UpdateIpcEntrySchema = CreateIpcEntrySchema.pick({ variationPct: true });
export type UpdateIpcEntryInput = z.infer<typeof UpdateIpcEntrySchema>;

export interface AdminEventListItem {
  id: string;
  name: string;
  type: EventType;
  eventDate: string | null;
  status: EventStatus;
}

export interface DashboardSummary {
  totals: {
    total: number;
    QUINCE: number;
    EGRESO: number;
    BODA: number;
    EMPRESARIAL: number;
  };
  /** Todos los eventos del tenant (no solo los próximos) — el frontend arma
   *  la vista "Próximos eventos" y el filtro por tarjeta a partir de esto. */
  events: AdminEventListItem[];
}

export interface AdminBeneficiaryDetail {
  id: string;
  /** Nombre del alumno en EGRESO; null en el resto (el beneficiary es el evento). */
  label: string | null;
  contactEmail: string | null;
  /** true si ya hay una cuenta de cliente vinculada a este beneficiary. */
  linked: boolean;
  cards: CardSummary[];
  minimumCharge: MinimumCharge | null;
  payments: PaymentSummary[];
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
}

/**
 * Vista admin de un evento — a diferencia de EventDetail (portal), no aplica
 * la restricción de privacidad titular-de-egreso: el staff ve el desglose de
 * TODOS los beneficiaries, incluso en un egreso con varios alumnos.
 */
export interface AdminEventDetail {
  id: string;
  type: EventType;
  name: string;
  eventDate: string | null;
  /** "HH:mm" — micrositio de invitados (Fase 3). */
  startTime: string | null;
  /** Link externo del fotógrafo — micrositio de invitados (Fase 3). */
  photosUrl: string | null;
  status: EventStatus;
  titularName: string | null;
  titularEmail: string | null;
  titularPhone: string | null;
  minGuests: number | null;
  soldByEmployeeId: string | null;
  soldByEmployeeName: string | null;
  soldAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  refundAmount: number | null;
  /** Último mes de IPC guardado (ISO) — para "actualizada con el IPC de X,
   *  próxima actualización con el de X+1". null = no hay IPC cargado. */
  latestIpcPeriod: string | null;
  beneficiaries: AdminBeneficiaryDetail[];
  totals: {
    totalValue: number;
    totalPaid: number;
    saldo: number;
    percentPaid: number;
  };
}

/** Fila parseada de la plantilla de importación de alumnos (egreso) — ver
 *  apps/api/src/modules/admin/importAlumnos.ts. `error` viene seteado si la
 *  fila no pasa las validaciones mínimas; el admin la revisa/corrige en el
 *  form antes de mandar el alta real. */
export interface ImportedAlumnoRow {
  row: number;
  label: string;
  contactEmail: string;
  contactPhone: string;
  error: string | null;
}

export interface EventContractSummary {
  fileName: string;
  uploadedAt: string;
}

/** Vista imprimible del detalle de pagos de un beneficiary puntual, para
 *  cuando un cliente pide el detalle y Cami/Fede se lo muestran/mandan a
 *  mano (Ctrl+P) — ver CLAUDE.md "Fase 2 — reporte de pagos". */
export interface BeneficiaryReport {
  eventName: string;
  eventType: EventType;
  beneficiaryLabel: string | null;
  cards: CardSummary[];
  minimumCharge: MinimumCharge | null;
  payments: PaymentSummary[];
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
  generatedAt: string;
}

/**
 * Vista "cliente" del panel admin — un mismo cliente (User) puede tener 2+
 * eventos (`EventAccount`), y hoy la única forma de revisar su estado era
 * ir evento por evento. `/admin/clientes` junta todo en un solo lugar (ver
 * CLAUDE.md "Fase 2 — vista de cliente").
 */
export interface ClientListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  eventCount: number;
}

export interface ClientEventSummary {
  eventAccountId: string;
  eventId: string;
  eventName: string;
  eventType: EventType;
  role: AccountRole;
  /** "own": este vínculo tiene beneficiary propio, se puede ver el desglose
   *  de tarjetas/pagos. "aggregate": titular de egreso, solo el total. */
  scope: 'own' | 'aggregate';
  totalValue: number;
  totalPaid: number;
  saldo: number;
  percentPaid: number;
}

export interface ClientDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  events: ClientEventSummary[];
}

export interface IpcHistoryEntry {
  id: string;
  period: string;
  indexValue: number;
  sourcePreviousValue: number;
  sourceLatestValue: number;
  fetchedAt: string;
  triggeredByName: string | null;
}

/** Ver CLAUDE.md "Fase 2 — IPC automático": pasado el día 14 del mes sin que
 *  datos.gob.ar haya publicado el período esperado, `stale` queda true y el
 *  panel admin muestra `message` en vez de dejar que el admin asuma que el
 *  último valor guardado sigue vigente. Nunca afecta al portal cliente. */
export interface IpcStalenessStatus {
  stale: boolean;
  message: string | null;
}

/** Una asignación de pago a esta tarjeta — "Pagas 18/40" → de dónde salen las 18. */
export interface CardPaidAllocation {
  paymentId: string;
  paymentDate: string;
  paymentAmount: number;
  note: string | null;
  quantity: number;
  /** Valor congelado por tarjeta. */
  unitValue: number;
  subtotal: number;
}

/** Un punto de la evolución del valor unitario de la tarjeta. */
export interface CardValuePoint {
  /** Mes (ISO, día 1). */
  period: string;
  unitValue: number;
  kind: 'ALTA' | 'IPC' | 'AJUSTE';
  /** % del IPC de ese mes (kind IPC). */
  variationPct: number | null;
  /** Motivo (kind AJUSTE). */
  reason: string | null;
}

export interface CardHistory {
  card: CardSummary;
  allocations: CardPaidAllocation[];
  /** Del más viejo al más nuevo. */
  valueHistory: CardValuePoint[];
}
