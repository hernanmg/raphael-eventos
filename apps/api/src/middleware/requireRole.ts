import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { getUserById } from '../modules/auth/auth.service';

/**
 * A diferencia de requireAuth (que solo mira la cookie de sesión),
 * requireRole necesita confirmar el rol actual del usuario contra la base
 * (el rol no viaja en la sesión) — por eso hace una query. Deja el usuario
 * en req.currentUser para que el handler no tenga que pedirlo de nuevo.
 */
export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }

    try {
      const user = await getUserById(req.tenantId, req.session.userId);
      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ error: { message: 'No autorizado' } });
        return;
      }
      req.currentUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}
