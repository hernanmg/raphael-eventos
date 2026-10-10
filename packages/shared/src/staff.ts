// Schemas y tipos del módulo de personal (Básica: ABM/asignación · Pro:
// horas/liquidación) — ver CLAUDE.md "Fase 2 — costeo y personal".

import { z } from 'zod';
import {
  EmployeeContractTypeSchema,
  EmployeeVariableTypeSchema,
  PayrollLineKindSchema,
} from './enums';
import type { EmployeeContractType, EmployeeVariableType, PayrollLineKind } from './enums';
import { optionalText } from './zodHelpers';

export const EmployeeInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá el nombre').max(160),
  /** Obligatorio (Fase 3): es el login del empleado si se le da acceso a la puerta. */
  email: z.string().trim().toLowerCase().email('Email inválido'),
  contractType: EmployeeContractTypeSchema,
  fixedMonthlyAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  /** Por evento TRABAJADO (asignación al evento). */
  variableType: EmployeeVariableTypeSchema.default('NINGUNO'),
  variableValue: z.coerce.number().min(0).max(1_000_000_000).default(0),
  /** Por evento VENDIDO (comisión de venta — decisión del cliente 2026-10). */
  saleCommissionType: EmployeeVariableTypeSchema.default('NINGUNO'),
  saleCommissionValue: z.coerce.number().min(0).max(1_000_000_000).default(0),
  /** Valor hora (hoja "HORAS SALON." de Fede). */
  hourlyRate: z.coerce.number().min(0).max(100_000_000).default(0),
  /** Rubro de costeo al que van sus gastos (por evento y liquidación). */
  costCategoryId: optionalText(z.string().trim().min(1)),
  active: z.coerce.boolean().default(true),
});
export type EmployeeInput = z.infer<typeof EmployeeInputSchema>;

export const EventStaffAssignmentInputSchema = z.object({
  employeeId: z.string().trim().min(1, 'Elegí un empleado'),
  note: optionalText(z.string().trim().max(160)),
});
export type EventStaffAssignmentInput = z.infer<typeof EventStaffAssignmentInputSchema>;

export const EmployeeTimeEntryInputSchema = z.object({
  date: z.string().trim().min(1, 'Elegí la fecha'),
  hours: optionalText(z.coerce.number().min(0).max(24)),
  note: optionalText(z.string().trim().max(160)),
  eventId: optionalText(z.string().trim().min(1)),
});
export type EmployeeTimeEntryInput = z.infer<typeof EmployeeTimeEntryInputSchema>;

export const PayrollPeriodInputSchema = z.object({
  /** Cualquier fecha del mes a liquidar — se normaliza al primer día. */
  period: z.string().trim().min(1, 'Elegí el período'),
});
export type PayrollPeriodInput = z.infer<typeof PayrollPeriodInputSchema>;

/** Línea de liquidación editable antes de confirmar: cantidad × unitario. */
export const PayrollLineInputSchema = z.object({
  kind: PayrollLineKindSchema,
  description: z.string().trim().min(1, 'Falta la descripción').max(200),
  quantity: z.coerce.number().min(0).max(100_000),
  /** En ADELANTO, el monto a descontar (positivo — se resta solo). */
  unitAmount: z.coerce.number().min(0).max(1_000_000_000),
});
export type PayrollLineInput = z.infer<typeof PayrollLineInputSchema>;

export const PayrollConfirmInputSchema = z.object({
  /** "YYYY-MM" o cualquier fecha del mes. */
  period: z.string().trim().min(1, 'Elegí el período'),
  lines: z.array(PayrollLineInputSchema).min(1, 'La liquidación no tiene líneas').max(100),
  note: optionalText(z.string().trim().max(300)),
});
export type PayrollConfirmInput = z.infer<typeof PayrollConfirmInputSchema>;

export const CommissionAdvanceInputSchema = z.object({
  date: z.string().trim().min(1, 'Elegí la fecha'),
  amount: z.coerce.number().positive().max(1_000_000_000),
  eventId: optionalText(z.string().trim().min(1)),
  note: optionalText(z.string().trim().max(200)),
});
export type CommissionAdvanceInput = z.infer<typeof CommissionAdvanceInputSchema>;

export interface EmployeeSummary {
  id: string;
  fullName: string;
  /** null solo en empleados cargados antes de que el email fuera obligatorio. */
  email: string | null;
  contractType: EmployeeContractType;
  fixedMonthlyAmount: number;
  variableType: EmployeeVariableType;
  variableValue: number;
  saleCommissionType: EmployeeVariableType;
  saleCommissionValue: number;
  hourlyRate: number;
  costCategoryId: string | null;
  costCategoryName: string | null;
  active: boolean;
  /** Tiene login PUERTA para el check-in de invitados (Fase 3). */
  hasDoorAccess: boolean;
}

/**
 * Respuesta al dar acceso a la puerta o resetearlo: la contraseña temporal se
 * devuelve UNA sola vez, en texto plano, para que el admin se la pase al
 * empleado (en persona o por email). No se guarda en ningún lado.
 */
export interface DoorAccessResult {
  email: string;
  temporaryPassword: string;
}

export interface EventStaffAssignmentSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  note: string | null;
}

export interface EmployeeTimeEntrySummary {
  id: string;
  date: string;
  hours: number | null;
  note: string | null;
  eventId: string | null;
  eventName: string | null;
}

export interface PayrollEntrySummary {
  id: string;
  period: string;
  fixedComponent: number;
  variableComponent: number;
  advancesDeducted: number;
  totalPaid: number;
  note: string | null;
  lines: PayrollLineSummary[];
  /** Gasto del mes generado en costeo (fijo + horas). */
  expenseAmount: number | null;
}

export interface PayrollLineSummary {
  id: string;
  kind: PayrollLineKind;
  description: string;
  quantity: number;
  unitAmount: number;
  /** quantity × unitAmount (negativo en ADELANTO). */
  amount: number;
}

/**
 * Borrador de liquidación de un mes: líneas sugeridas a partir de lo cargado
 * (fijo, horas × valor hora, eventos trabajados, comisiones por eventos
 * vendidos, adelantos sin descontar). Nada se guarda hasta confirmar.
 */
export interface PayrollPreview {
  period: string;
  lines: PayrollLineInput[];
  /** Ya hay una liquidación confirmada para ese mes (se reemplaza al confirmar). */
  existing: PayrollEntrySummary | null;
  reference: {
    hours: number;
    hourlyRate: number;
    eventsWorked: { id: string; name: string; date: string | null; costedAmount: number }[];
    eventsSold: { id: string; name: string; soldAt: string | null; costedAmount: number }[];
    advances: { id: string; date: string; amount: number; note: string | null }[];
  };
}

export interface CommissionAdvanceSummary {
  id: string;
  date: string;
  amount: number;
  eventId: string | null;
  eventName: string | null;
  note: string | null;
  reconciledInEntryId: string | null;
}
