import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { EventNotAccessibleError, getUserEventDetail, listUserEvents } from './portal.service';

export const portalRouter = Router();

portalRouter.use(requireAuth);

portalRouter.get('/events', async (req, res, next) => {
  try {
    const events = await listUserEvents(req.tenantId, req.session.userId!);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

portalRouter.get('/events/:eventId', async (req, res, next) => {
  try {
    const event = await getUserEventDetail(req.tenantId, req.session.userId!, req.params.eventId);
    res.json({ event });
  } catch (err) {
    if (err instanceof EventNotAccessibleError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});
