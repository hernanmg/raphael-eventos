import { Router, type Response } from 'express';
import {
  CheckInAdmitSchema,
  CheckInLookupSchema,
  CheckInRejectSchema,
} from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  CheckInEventNotFoundError,
  CheckInGuestNotFoundError,
  GuestCancelledError,
  ReentryNoteRequiredError,
  WrongEventError,
  admitGuest,
  getCheckInEvent,
  listCheckInEvents,
  lookupGuests,
  rejectGuest,
} from './checkin.service';

export const checkInRouter = Router();

// Check-in de invitados (Fase 3): empleados con rol PUERTA (acotado a sus
// eventos asignados, ver checkin.service.ts) + el staff del panel.
checkInRouter.use(requireRole('ADMIN', 'VENDEDOR', 'PUERTA'));

function handleCheckInError(err: unknown, res: Response): boolean {
  if (err instanceof CheckInEventNotFoundError) {
    res.status(404).json({ error: { message: 'Evento no encontrado' } });
    return true;
  }
  if (err instanceof CheckInGuestNotFoundError) {
    res.status(404).json({ error: { message: 'No encontramos ese invitado en este evento' } });
    return true;
  }
  if (err instanceof WrongEventError) {
    res.status(409).json({ error: { message: 'Esta entrada es de OTRO evento' } });
    return true;
  }
  if (err instanceof GuestCancelledError) {
    res.status(409).json({ error: { message: 'Esta entrada fue dada de baja — no es válida' } });
    return true;
  }
  if (err instanceof ReentryNoteRequiredError) {
    res.status(400).json({
      error: {
        message: 'Ya ingresó antes: para un reingreso anotá cómo lo verificaste',
        code: 'REENTRY_NOTE_REQUIRED',
      },
    });
    return true;
  }
  return false;
}

checkInRouter.get('/events', async (req, res, next) => {
  try {
    res.json({ events: await listCheckInEvents(req.tenantId, req.currentUser!) });
  } catch (err) {
    next(err);
  }
});

checkInRouter.get('/events/:eventId', async (req, res, next) => {
  try {
    res.json({ event: await getCheckInEvent(req.tenantId, req.currentUser!, req.params.eventId!) });
  } catch (err) {
    if (!handleCheckInError(err, res)) next(err);
  }
});

// POST (no GET) para que el contenido del QR no quede en logs de URLs.
checkInRouter.post('/events/:eventId/lookup', async (req, res, next) => {
  try {
    const input = parseBody(CheckInLookupSchema, req.body, res);
    if (!input) return;
    const guests = await lookupGuests(req.tenantId, req.currentUser!, req.params.eventId!, input);
    res.json({ guests });
  } catch (err) {
    if (!handleCheckInError(err, res)) next(err);
  }
});

checkInRouter.post('/events/:eventId/guests/:guestId/admit', async (req, res, next) => {
  try {
    const input = parseBody(CheckInAdmitSchema, req.body, res);
    if (!input) return;
    const guest = await admitGuest(
      req.tenantId,
      req.currentUser!,
      req.params.eventId!,
      req.params.guestId!,
      input,
    );
    res.status(201).json({ guest });
  } catch (err) {
    if (!handleCheckInError(err, res)) next(err);
  }
});

checkInRouter.post('/events/:eventId/guests/:guestId/reject', async (req, res, next) => {
  try {
    const input = parseBody(CheckInRejectSchema, req.body, res);
    if (!input) return;
    await rejectGuest(
      req.tenantId,
      req.currentUser!,
      req.params.eventId!,
      req.params.guestId!,
      input,
    );
    res.status(201).end();
  } catch (err) {
    if (!handleCheckInError(err, res)) next(err);
  }
});
