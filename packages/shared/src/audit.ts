// Registro de auditoría (Fase 4) — ver CLAUDE.md "Fase 4".

export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogEntry {
  id: string;
  /** Foto del nombre/email al momento del cambio. */
  actorLabel: string;
  /** null = sistema (cron). */
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  eventId: string | null;
  action: AuditActionType;
  summary: string;
  changes: unknown;
  createdAt: string;
}

/** Áreas de la pantalla de auditoría → entityTypes que agrupa. */
export const AUDIT_AREAS: Record<string, { label: string; entityTypes: string[] }> = {
  eventos: { label: 'Eventos y tarjetas', entityTypes: ['Event', 'EventCard', 'EventContract'] },
  pagos: { label: 'Pagos', entityTypes: ['Payment'] },
  ipc: { label: 'IPC', entityTypes: ['IpcIndexValue'] },
  costeo: {
    label: 'Costeo',
    entityTypes: [
      'TenantCostConfig',
      'SupplyCategory',
      'ServiceCostCategory',
      'FixedCostCategory',
      'EventSupplyLine',
      'EventServiceCost',
    ],
  },
  personal: {
    label: 'Personal',
    entityTypes: [
      'Employee',
      'EventStaffAssignment',
      'EmployeeTimeEntry',
      'PayrollEntry',
      'EmployeeCommissionAdvance',
    ],
  },
  directorio: { label: 'Proveedores y sponsors', entityTypes: ['Provider', 'Sponsor'] },
};

export interface AuditLogPage {
  entries: AuditLogEntry[];
  /** Para pedir la página siguiente (más vieja); null si no hay más. */
  nextCursor: string | null;
}
