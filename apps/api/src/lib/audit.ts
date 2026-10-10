import type { Prisma } from '@prisma/client';
import { currentActor } from './requestContext';

/**
 * Registro de auditoría (Fase 4). Se llama SIEMPRE con el `tx` de la misma
 * transacción que hace el cambio: si el cambio se revierte, el log también,
 * y viceversa. La tabla es append-only a nivel de base (app_user solo
 * SELECT/INSERT). Qué se traza y qué no: ver CLAUDE.md "Fase 4".
 */
export type AuditEntityType =
  | 'Event'
  | 'EventCard'
  | 'Payment'
  | 'IpcIndexValue'
  | 'TenantCostConfig'
  | 'CostCategory'
  | 'Expense'
  | 'SupplyCategory'
  | 'ServiceCostCategory'
  | 'FixedCostCategory'
  | 'EventSupplyLine'
  | 'EventServiceCost'
  | 'Employee'
  | 'EventStaffAssignment'
  | 'EmployeeTimeEntry'
  | 'PayrollEntry'
  | 'EmployeeCommissionAdvance'
  | 'EventContract'
  | 'Provider'
  | 'Sponsor'
  | 'User';

export interface AuditEntry {
  entityType: AuditEntityType;
  entityId: string;
  eventId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  summary: string;
  changes?: Record<string, { de: unknown; a: unknown }> | Record<string, unknown> | null;
}

export async function audit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  entry: AuditEntry,
): Promise<void> {
  const actor = currentActor();
  await tx.auditLog.create({
    data: {
      tenantId,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      entityType: entry.entityType,
      entityId: entry.entityId,
      eventId: entry.eventId ?? null,
      action: entry.action,
      summary: entry.summary,
      changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Normaliza para comparar/serializar: Decimal → number, Date → ISO. */
function plain(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  if (Array.isArray(value)) return value.map(plain);
  return value;
}

/**
 * `{campo: {de, a}}` solo de los campos que cambiaron. null si no cambió
 * nada (el caller decide si igual registra).
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  // `unknown` por campo: el input trae number donde la fila tiene Decimal
  // (se normalizan los dos con plain() antes de comparar).
  after: { [K in keyof T]?: unknown },
  fields: (keyof T)[],
): Record<string, { de: unknown; a: unknown }> | null {
  const out: Record<string, { de: unknown; a: unknown }> = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const de = plain(before[field]);
    const a = plain(after[field]);
    if (JSON.stringify(de) !== JSON.stringify(a)) out[field as string] = { de, a };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Snapshot plano de campos (para CREATE/DELETE). */
export function snapshot<T extends Record<string, unknown>>(
  row: T,
  fields: (keyof T)[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field as string] = plain(row[field]);
  return out;
}

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

export function money(value: number | Prisma.Decimal): string {
  return ars.format(Number(value));
}
