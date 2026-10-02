import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginSchema, RegisterSchema } from '@raphael-eventos/shared';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  getTenantPlan,
  getUserById,
  registerUser,
  toPublicUser,
  verifyLogin,
} from './auth.service';
import { requireAuth } from '../../middleware/requireAuth';
import { regenerateSession, saveSession, destroySession } from '../../lib/session';
import { parseBody } from '../../lib/validate';

// Freno a fuerza bruta sobre login, tal como se definió en la arquitectura de auth.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos. Probá de nuevo en unos minutos.' } },
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const input = parseBody(RegisterSchema, req.body, res);
    if (!input) return;

    const user = await registerUser({ tenantId: req.tenantId, ...input });

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.tenantId = req.tenantId;
    await saveSession(req);

    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      res.status(409).json({ error: { message: 'Ya existe una cuenta con ese email' } });
      return;
    }
    next(err);
  }
});

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const input = parseBody(LoginSchema, req.body, res);
    if (!input) return;

    const user = await verifyLogin({ tenantId: req.tenantId, ...input });

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.tenantId = req.tenantId;
    await saveSession(req);

    res.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: { message: 'Email o contraseña incorrectos' } });
      return;
    }
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await destroySession(req);
    res.clearCookie('connect.sid');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.tenantId, req.session.userId!);
    if (!user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const tenantPlan = await getTenantPlan(req.tenantId);
    res.json({ user: toPublicUser(user), tenantPlan });
  } catch (err) {
    next(err);
  }
});
