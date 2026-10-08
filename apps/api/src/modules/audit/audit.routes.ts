import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { listAuditLog } from './audit.service';

// Auditoría (Fase 4): Cami y Fede ven todo por igual (ADMIN/VENDEDOR).
export const auditRouter = Router();
auditRouter.use(requireRole('ADMIN', 'VENDEDOR'));

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

auditRouter.get('/audit', async (req, res, next) => {
  try {
    res.json(
      await listAuditLog(req.tenantId, {
        area: str(req.query.area),
        eventId: str(req.query.eventId),
        actor: str(req.query.actor),
        from: str(req.query.from),
        to: str(req.query.to),
        cursor: str(req.query.cursor),
      }),
    );
  } catch (err) {
    next(err);
  }
});

/** "Historial" del detalle de un evento. */
auditRouter.get('/events/:eventId/history', async (req, res, next) => {
  try {
    res.json(
      await listAuditLog(req.tenantId, {
        eventId: req.params.eventId,
        cursor: str(req.query.cursor),
      }),
    );
  } catch (err) {
    next(err);
  }
});
