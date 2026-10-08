import type {
  AccountRole,
  CardType,
  EmployeeContractType,
  EmployeeVariableType,
  EventType,
  LeadStatus,
} from '@raphael-eventos/shared';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

// Fechas de calendario (eventDate, paymentDate, períodos, fecha tentativa):
// el backend las guarda como medianoche UTC del día elegido, así que se
// formatean en UTC. En la zona del navegador (Argentina, UTC-3) "2026-12-12
// 00:00Z" caía el 11 — bug real: toda fecha de evento se mostraba un día antes.
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(iso: string | null): string {
  if (!iso) return 'Fecha a confirmar';
  return dateFormatter.format(new Date(iso));
}

// Instantes reales (createdAt, uploadedAt, sentAt...): en la hora local.
const timestampFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatTimestamp(iso: string): string {
  return timestampFormatter.format(new Date(iso));
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  QUINCE: '15 años',
  EGRESO: 'Egresados',
  BODA: 'Boda',
  EMPRESARIAL: 'Empresarial',
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  ADULTO: 'Adulto',
  ADOLESCENTE: 'Adolescente',
  MENOR: 'Menor',
  BRINDIS: 'Brindis',
};

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  TITULAR: 'Titular',
  PARTICIPANTE: 'Participante',
};

export const CONTRACT_TYPE_LABELS: Record<EmployeeContractType, string> = {
  EN_BLANCO: 'En blanco',
  MONOTRIBUTO: 'Monotributo',
  INFORMAL: 'Informal',
};

export const VARIABLE_TYPE_LABELS: Record<EmployeeVariableType, string> = {
  NINGUNO: 'Sin variable',
  MONTO_POR_EVENTO: 'Monto fijo por evento',
  COMISION_PCT: 'Comisión %',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CON_SENA: 'Con seña',
  GANADO: 'Ganado',
  PERDIDO: 'Perdido',
};
