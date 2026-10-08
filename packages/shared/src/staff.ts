// Schemas y tipos del módulo de personal (Básica: ABM/asignación · Pro:
// horas/liquidación) — ver CLAUDE.md "Fase 2 — costeo y personal".

import { z } from 'zod';
import { EmployeeContractTypeSchema, EmployeeVariableTypeSchema } from './enums';
import type { EmployeeContractType, EmployeeVariableType } from './enums';
import { optionalText } from './zodHelpers';

export const EmployeeInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá el nombre').max(160),
  /** Obligatorio (Fase 3): es el login del empleado si se le da acceso a la puerta. */
  email: z.string().trim().toLowerCase().email('Email inválido'),
  contractType: EmployeeContractTypeSchema,
  fixedMonthlyAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  variableType: EmployeeVariableTypeSchema.default('NINGUNO'),
  variableValue: z.coerce.number().min(0).max(1_000_000_000).default(0),
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
