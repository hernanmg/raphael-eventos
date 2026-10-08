import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ChangePasswordSchema, LoginSchema, RegisterSchema } from '@raphael-eventos/shared';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  changePassword,
  getTenantPlan,
  getUserById,
  registerUser,
  toPublicUser,
  verifyLogin,
} from './auth.service';
import { requireAuth } from '../../middleware/requireAuth';
import { regenerateSession, saveSession, destroySession } from '../../lib/session';
import { parseBody } from '../../lib/validate';

// Freno a fuerza bruta sobre login. Ventana fija de 15 min que se libera
// sola (no hace falta reiniciar nada) y SOLO cuentan los intentos fallidos
// (skipSuccessfulRequests) — pensado para la puerta de un evento: varios
// empleados entrando desde el mismo wifi no se bloquean entre sí, y el que
// se equivoca de contraseña solo se traba a sí mismo, como mucho 15 min.
//
// Store en memoria: alcanza con una sola instancia de la API. Si algún día
// corre más de una, pasar a un store compartido (Postgres/Redis).
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const tooManyAttempts = {
  error: {
    message: 'Demasiados intentos fallidos. Esperá unos minutos (como máximo 15) y probá de nuevo.',
  },
};

function emailFromBody(body: unknown): string {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Por cuenta: 10 fallos por IP + email. */
const loginAccountLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${emailFromBody(req.body)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyAttempts,
});

/** Por IP, más holgado: frena probar muchas cuentas distintas desde un mismo lugar. */
const loginIpLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyAttempts,
});

/** Cambio de contraseña: verifica la actual, así que también es superficie de fuerza bruta. */
const changePasswordLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${req.session.userId ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyAttempts,
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

authRouter.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res, next) => {
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

authRouter.post('/change-password', requireAuth, changePasswordLimiter, async (req, res, next) => {
  try {
    const input = parseBody(ChangePasswordSchema, req.body, res);
    if (!input) return;

    const user = await changePassword({
      tenantId: req.tenantId,
      userId: req.session.userId!,
      ...input,
    });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(400).json({ error: { message: 'La contraseña actual no es correcta' } });
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
