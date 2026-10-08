import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { GuestRsvpSchema } from '@raphael-eventos/shared';
import { parseBody } from '../../lib/validate';
import {
  GuestNotFoundError,
  InviteNotFoundError,
  RsvpClosedError,
  getGuestPass,
  getInviteView,
  rsvpByInvite,
} from './guests.service';

// Rutas públicas del micrositio de invitados (Fase 3) — sin cuenta, el
// acceso es por posesión del token (no adivinable). Mismo criterio de rate
// limit que POST /leads para el alta; un freno más holgado para las lecturas.
const rsvpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas confirmaciones. Probá de nuevo en unos minutos.' } },
});

const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas solicitudes. Probá de nuevo en unos minutos.' } },
});

export const guestsPublicRouter = Router();

guestsPublicRouter.get('/invite/:inviteToken', lookupLimiter, async (req, res, next) => {
  try {
    res.json({ invite: await getInviteView(req.tenantId, req.params.inviteToken!) });
  } catch (err) {
    if (err instanceof InviteNotFoundError) {
      res.status(404).json({ error: { message: 'Esta invitación no existe o ya no está activa' } });
      return;
    }
    next(err);
  }
});

guestsPublicRouter.post('/invite/:inviteToken/rsvp', rsvpLimiter, async (req, res, next) => {
  try {
    const input = parseBody(GuestRsvpSchema, req.body, res);
    if (!input) return;
    res.status(201).json(await rsvpByInvite(req.tenantId, req.params.inviteToken!, input));
  } catch (err) {
    if (err instanceof InviteNotFoundError) {
      res.status(404).json({ error: { message: 'Esta invitación no existe o ya no está activa' } });
      return;
    }
    if (err instanceof RsvpClosedError) {
      res.status(409).json({
        error: {
          message:
            'Las confirmaciones por link ya cerraron. Si querés ir, hablalo con quien te invitó.',
        },
      });
      return;
    }
    next(err);
  }
});

guestsPublicRouter.get('/guest/:qrToken', lookupLimiter, async (req, res, next) => {
  try {
    res.json({ pass: await getGuestPass(req.tenantId, req.params.qrToken!) });
  } catch (err) {
    if (err instanceof GuestNotFoundError) {
      res.status(404).json({ error: { message: 'Entrada no encontrada' } });
      return;
    }
    next(err);
  }
});
