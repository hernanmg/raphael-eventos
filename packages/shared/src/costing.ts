// Schemas y tipos del módulo de costeo (Plan Pro). Rediseño de octubre 2026
// (feedback de uso real): el costeo sale de GASTOS reales (con ticket e
// ítems, estructura de la hoja PRECIOS. de Fede), agrupados por rubro y
// proveedor — ver CLAUDE.md "Feedback de uso real (2026-10-09)". Mismo
// criterio que admin.ts: input = Zod, respuestas = interfaces planas.

import { z } from 'zod';
import { CostCategoryKindSchema, SupplyUnitSchema } from './enums';
import type { CostCategoryKind, SupplyUnit } from './enums';
import { optionalText } from './zodHelpers';

export const TenantCostConfigInputSchema = z.object({
  gananciaPct: z.coerce.number().min(0).max(5),
  roturaPct: z.coerce.number().min(0).max(5),
  ivaPct: z.coerce.number().min(0).max(5),
  insumoRenegotiationPct: z.coerce.number().min(0).max(5),
  advanceDepositCapPct: z.coerce.number().min(0).max(1),
  /** Impuesto a los créditos bancarios (0,0006 = 0,06%). */
  bankCreditTaxPct: z.coerce.number().min(0).max(0.1),
  /** Impuesto a los débitos bancarios. */
  bankDebitTaxPct: z.coerce.number().min(0).max(0.1),
  /** Monto fijo por transferencia, por evento. */
  bankTransferFee: z.coerce.number().min(0).max(10_000_000),
});
export type TenantCostConfigInput = z.infer<typeof TenantCostConfigInputSchema>;

export interface TenantCostConfigSummary {
  gananciaPct: number;
  roturaPct: number;
  ivaPct: number;
  insumoRenegotiationPct: number;
  advanceDepositCapPct: number;
  bankCreditTaxPct: number;
  bankDebitTaxPct: number;
  bankTransferFee: number;
}

/** Rubro de costeo (catálogo único). `monthlyAmount`/`guestScaled` solo
 *  aplican a los FIJO (estimado mensual mientras no haya gastos reales). */
export const CostCategoryInputSchema = z.object({
  kind: CostCategoryKindSchema,
  name: z.string().trim().min(1, 'Ingresá un nombre').max(120),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  monthlyAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  guestScaled: z.coerce.boolean().default(false),
});
export type CostCategoryInput = z.infer<typeof CostCategoryInputSchema>;

export interface CostCategorySummary {
  id: string;
  kind: CostCategoryKind;
  name: string;
  sortOrder: number;
  monthlyAmount: number;
  guestScaled: boolean;
}

export const ExpenseItemInputSchema = z.object({
  productName: z.string().trim().min(1, 'Ingresá el producto').max(160),
  /** Texto libre como en el Excel: "x6", "5L", "cajón". */
  presentation: optionalText(z.string().trim().max(60)),
  quantity: z.coerce.number().positive('La cantidad tiene que ser mayor a 0').max(1_000_000),
  unit: SupplyUnitSchema,
  unitCost: z.coerce.number().min(0).max(1_000_000_000),
});
export type ExpenseItemInput = z.infer<typeof ExpenseItemInputSchema>;

/**
 * Gasto real (ticket). Va contra un evento (`eventId`) o contra un mes del
 * salón (`period` = "YYYY-MM", gastos fijos). Con ítems, el monto es su suma
 * (lo calcula el server); sin ítems, `amount` es obligatorio. El ticket va
 * como archivo aparte en el mismo multipart (campo `receipt`).
 */
export const ExpenseInputSchema = z
  .object({
    eventId: optionalText(z.string().trim().min(1)),
    period: optionalText(
      z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}$/, 'Mes inválido'),
    ),
    date: z.string().trim().min(1, 'Elegí la fecha'),
    categoryId: z.string().trim().min(1, 'Elegí un rubro'),
    providerId: optionalText(z.string().trim().min(1)),
    amount: optionalText(z.coerce.number().min(0).max(1_000_000_000)),
    detail: optionalText(z.string().trim().max(500)),
    items: z.array(ExpenseItemInputSchema).max(300).default([]),
    /** Solo en edición: quitar el ticket adjunto. */
    removeReceipt: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.eventId) !== Boolean(v.period), {
    message: 'Elegí un evento o un mes (gasto del salón)',
    path: ['eventId'],
  })
  .refine((v) => v.items.length > 0 || v.amount !== undefined, {
    message: 'Cargá el monto o al menos un ítem',
    path: ['amount'],
  });
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

export type ExpenseAutoSource = 'STAFF_EVENT' | 'SALE_COMMISSION' | 'PAYROLL';

export interface ExpenseItemSummary {
  id: string;
  productName: string;
  presentation: string | null;
  quantity: number;
  unit: SupplyUnit;
  unitCost: number;
  lineCost: number;
  /** El precio unitario cambió más que insumoRenegotiationPct vs. la última
   *  compra del mismo producto — solo informativo, nunca bloquea nada. */
  renegotiationWarning: boolean;
}

export interface ExpenseSummary {
  id: string;
  eventId: string | null;
  eventName: string | null;
  /** "YYYY-MM" en gastos del salón (sin evento). */
  period: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryKind: CostCategoryKind | null;
  providerId: string | null;
  providerName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  amount: number;
  detail: string | null;
  autoSource: ExpenseAutoSource | null;
  manuallyEdited: boolean;
  receiptName: string | null;
  items: ExpenseItemSummary[];
}

/** Totales por rubro de un listado de gastos. */
export interface ExpenseCategoryTotal {
  categoryId: string | null;
  categoryName: string;
  kind: CostCategoryKind | null;
  total: number;
  count: number;
}

export interface ExpenseList {
  expenses: ExpenseSummary[];
  byCategory: ExpenseCategoryTotal[];
  total: number;
}

export interface CostingProviderGroup {
  providerId: string | null;
  providerName: string | null;
  total: number;
  expenses: ExpenseSummary[];
}

export interface CostingCategoryGroup {
  categoryId: string | null;
  categoryName: string;
  kind: CostCategoryKind | null;
  total: number;
  providers: CostingProviderGroup[];
}

export interface FixedCostProration {
  categoryId: string | null;
  categoryName: string;
  /** Monto del mes que se prorratea. */
  monthlyBase: number;
  /** REAL = suma de gastos del mes cargados; ESTIMADO = monto configurado. */
  source: 'REAL' | 'ESTIMADO';
  guestScaled: boolean;
  proratedAmount: number;
}

/**
 * Costeo de un evento (fórmula de Fede, porcentajes SUMADOS — decisión del
 * cliente 2026-10):
 *   neto      = Σ gastos del evento + prorrateo de gastos del mes + impuestos bancarios
 *   x100      = neto / (invitados / 100)
 *   tarjeta   = x100 × (1 + ganancia + rotura + iva)
 */
export interface EventCostingSummary {
  guestCount: number;
  eventsInMonth: number;
  groups: CostingCategoryGroup[];
  totalExpenses: number;
  fixedCostBreakdown: FixedCostProration[];
  totalFixedCostProrated: number;
  bankTaxes: { creditDebit: number; transferFee: number; total: number };
  costoNeto: number;
  costoPor100Invitados: number;
  /** ganancia + rotura + iva (sumados). */
  markupPct: number;
  costoTarjeta: number;
}
