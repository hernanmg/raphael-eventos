import type { Prisma } from '@prisma/client';
import { AUDIT_AREAS, type AuditLogEntry, type AuditLogPage } from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';

const PAGE_SIZE = 100;

export interface AuditQuery {
  area?: string;
  eventId?: string;
  /** Texto libre sobre la foto del actor (nombre/email). */
  actor?: string;
  from?: string;
  to?: string;
  /** createdAt ISO de la última fila de la página anterior. */
  cursor?: string;
}

/** Solo lectura: la tabla es append-only en la base (SELECT/INSERT). */
export async function listAuditLog(tenantId: string, query: AuditQuery): Promise<AuditLogPage> {
  return withTenant(tenantId, async (tx) => {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lt = new Date(query.to);
    if (query.cursor) createdAt.lt = new Date(query.cursor);

    const area = query.area ? AUDIT_AREAS[query.area] : undefined;
    const rows = await tx.auditLog.findMany({
      where: {
        tenantId,
        ...(area ? { entityType: { in: area.entityTypes } } : {}),
        ...(query.eventId ? { eventId: query.eventId } : {}),
        ...(query.actor ? { actorLabel: { contains: query.actor, mode: 'insensitive' } } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    });

    const page = rows.slice(0, PAGE_SIZE);
    const entries: AuditLogEntry[] = page.map((row) => ({
      id: row.id,
      actorLabel: row.actorLabel,
      actorUserId: row.actorUserId,
      entityType: row.entityType,
      entityId: row.entityId,
      eventId: row.eventId,
      action: row.action,
      summary: row.summary,
      changes: row.changes,
      createdAt: row.createdAt.toISOString(),
    }));
    return {
      entries,
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
  });
}
