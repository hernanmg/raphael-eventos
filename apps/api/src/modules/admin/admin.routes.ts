import { Router } from 'express';
import { CreateEventSchema, CreateIpcEntrySchema } from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  EventNotFoundError,
  addIpcEntry,
  createEvent,
  getDashboard,
  getEventDetailForAdmin,
  listIpcHistory,
} from './admin.service';

export const adminRouter = Router();

// Vendedor == admin en Fase 1: no hay CRM/calendario todavía que los
// diferencie (ver CLAUDE.md).
adminRouter.use(requireRole('ADMIN', 'VENDEDOR'));

adminRouter.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await getDashboard(req.tenantId);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/events', async (req, res, next) => {
  try {
    const input = parseBody(CreateEventSchema, req.body, res);
    if (!input) return;

    const event = await createEvent(req.tenantId, req.currentUser!.id, input);
    res.status(201).json({ event: { id: event.id, name: event.name } });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/events/:eventId', async (req, res, next) => {
  try {
    const event = await getEventDetailForAdmin(req.tenantId, req.params.eventId);
    res.json({ event });
  } catch (err) {
    if (err instanceof EventNotFoundError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});

adminRouter.get('/ipc', async (req, res, next) => {
  try {
    const history = await listIpcHistory(req.tenantId);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/ipc', async (req, res, next) => {
  try {
    const input = parseBody(CreateIpcEntrySchema, req.body, res);
    if (!input) return;

    const entry = await addIpcEntry(req.tenantId, req.currentUser!.id, input);
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});
