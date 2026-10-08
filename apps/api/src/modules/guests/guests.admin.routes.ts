import { Router, type Response } from 'express';
import { AdminGuestInputSchema, EventPublicInfoSchema } from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  EventNotFoundError,
  GuestNotFoundError,
  InvalidBeneficiaryError,
  addAdminGuest,
  cancelAdminGuest,
  ensureAdminInviteLink,
  getAdminGuests,
  updateEventPublicInfo,
} from './guests.service';

// Invitados desde el panel (Fase 3): el staff ve y gestiona todos los
// invitados del evento, sin el recorte por familia del portal.
export const guestsAdminRouter = Router();
guestsAdminRouter.use(requireRole('ADMIN', 'VENDEDOR'));

function handleGuestError(err: unknown, res: Response): boolean {
  if (err instanceof EventNotFoundError) {
    res.status(404).json({ error: { message: 'Evento no encontrado' } });
    return true;
  }
  if (err instanceof GuestNotFoundError) {
    res.status(404).json({ error: { message: 'Invitado no encontrado' } });
    return true;
  }
  if (err instanceof InvalidBeneficiaryError) {
    res.status(400).json({ error: { message: 'Esa familia/alumno no pertenece al evento' } });
    return true;
  }
  return false;
}

guestsAdminRouter.get('/events/:eventId/guests', async (req, res, next) => {
  try {
    res.json(await getAdminGuests(req.tenantId, req.params.eventId!));
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsAdminRouter.post('/events/:eventId/guests', async (req, res, next) => {
  try {
    const input = parseBody(AdminGuestInputSchema, req.body, res);
    if (!input) return;
    const guest = await addAdminGuest(
      req.tenantId,
      req.params.eventId!,
      req.currentUser!.id,
      input,
    );
    res.status(201).json({ guest });
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsAdminRouter.post('/guests/:guestId/cancel', async (req, res, next) => {
  try {
    await cancelAdminGuest(req.tenantId, req.params.guestId!);
    res.status(204).end();
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsAdminRouter.post('/beneficiaries/:beneficiaryId/invite-link', async (req, res, next) => {
  try {
    res.json(await ensureAdminInviteLink(req.tenantId, req.params.beneficiaryId!));
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});

guestsAdminRouter.put('/events/:eventId/public-info', async (req, res, next) => {
  try {
    const input = parseBody(EventPublicInfoSchema, req.body, res);
    if (!input) return;
    res.json({ info: await updateEventPublicInfo(req.tenantId, req.params.eventId!, input) });
  } catch (err) {
    if (!handleGuestError(err, res)) next(err);
  }
});
