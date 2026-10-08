import { Router, type Response } from 'express';
import { GuestInputSchema } from '@raphael-eventos/shared';
import { requirePortalAccess } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  EventNotFoundError,
  GuestAccessDeniedError,
  GuestNotFoundError,
  addPortalGuest,
  cancelPortalGuest,
  ensurePortalInviteLink,
  getPortalGuests,
} from './guests.service';

// Invitados desde el portal del titular (Fase 3). Mismo guard explícito que
// el resto del portal: PUERTA queda afuera con 403.
export const guestsPortalRouter = Router();
guestsPortalRouter.use(requirePortalAccess());

function handleGuestError(err: unknown, res: Response): boolean {
  if (err instanceof EventNotFoundError) {
    res.status(404).json({ error: { message: 'Evento no encontrado' } });
    return true;
  }
  if (err instanceof GuestNotFoundError) {
    res.status(404).json({ error: { message: 'Invitado no encontrado' } });
    return true;
  }
  if (err instanceof GuestAccessDeniedError) {
    res.status(403).json({ error: { message: 'No podés gestionar invitados de este evento' } });
    return true;
  }
  return false;
}

guestsPortalRouter.get('/events/:eventId/guests', async (req, res, next) => {
  try {
    res.json(await getPortalGuests(req.tenantId, req.session.userId!, req.params.eventId!));
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsPortalRouter.post('/events/:eventId/invite-link', async (req, res, next) => {
  try {
    res.json(await ensurePortalInviteLink(req.tenantId, req.session.userId!, req.params.eventId!));
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsPortalRouter.post('/events/:eventId/guests', async (req, res, next) => {
  try {
    const input = parseBody(GuestInputSchema, req.body, res);
    if (!input) return;
    const guest = await addPortalGuest(
      req.tenantId,
      req.session.userId!,
      req.params.eventId!,
      input,
    );
    res.status(201).json({ guest });
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsPortalRouter.post('/guests/:guestId/cancel', async (req, res, next) => {
  try {
    await cancelPortalGuest(req.tenantId, req.session.userId!, req.params.guestId!);
    res.status(204).end();
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});
