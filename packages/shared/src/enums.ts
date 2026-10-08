// Enums del modelo de datos, en espejo con apps/api/prisma/schema.prisma.
// Se comparten como Zod schemas (no solo tipos) para poder validar payloads
// tanto en el cliente (formularios) como en el servidor (Express) con la misma fuente.

import { z } from 'zod';

export const PlanSchema = z.enum(['BASICA', 'PRO']);
export type Plan = z.infer<typeof PlanSchema>;

export const RoleSchema = z.enum(['ADMIN', 'VENDEDOR', 'CLIENTE', 'PUERTA']);
export type Role = z.infer<typeof RoleSchema>;

export const EventTypeSchema = z.enum(['QUINCE', 'EGRESO', 'BODA', 'EMPRESARIAL']);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EventStatusSchema = z.enum(['ACTIVO', 'FINALIZADO', 'CANCELADO']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const CardTypeSchema = z.enum(['ADULTO', 'ADOLESCENTE', 'MENOR', 'BRINDIS']);
export type CardType = z.infer<typeof CardTypeSchema>;

export const AccountRoleSchema = z.enum(['TITULAR', 'PARTICIPANTE']);
export type AccountRole = z.infer<typeof AccountRoleSchema>;

export const TokenPurposeSchema = z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']);
export type TokenPurpose = z.infer<typeof TokenPurposeSchema>;

export const EmployeeContractTypeSchema = z.enum(['EN_BLANCO', 'MONOTRIBUTO', 'INFORMAL']);
export type EmployeeContractType = z.infer<typeof EmployeeContractTypeSchema>;

export const EmployeeVariableTypeSchema = z.enum(['NINGUNO', 'MONTO_POR_EVENTO', 'COMISION_PCT']);
export type EmployeeVariableType = z.infer<typeof EmployeeVariableTypeSchema>;

export const LeadStatusSchema = z.enum(['NUEVO', 'CONTACTADO', 'CON_SENA', 'GANADO', 'PERDIDO']);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const SupplyUnitSchema = z.enum(['KG', 'LITROS', 'UNIDAD']);
export type SupplyUnit = z.infer<typeof SupplyUnitSchema>;
