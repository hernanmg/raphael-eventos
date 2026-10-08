import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { getUserById, userCanOperate } from '../modules/auth/auth.service';

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
      // Contraseña temporal sin cambiar (Fase 3): nada más que /auth/change-password.
      if (user.mustChangePassword) {
        res.status(403).json({
          error: { message: 'Tenés que cambiar tu contraseña temporal antes de seguir' },
        });
        return;
      }
      // Empleado PUERTA dado de baja: corta también sesiones ya abiertas.
      if (!(await userCanOperate(req.tenantId, user))) {
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

/**
 * Roles que pueden usar el portal cliente. PUERTA queda afuera de forma
 * explícita (403) — no alcanza con que sus consultas devuelvan vacío por no
 * tener EventAccount: eso es un efecto de los datos, no una regla.
 */
export const requirePortalAccess = () => requireRole('CLIENTE', 'ADMIN', 'VENDEDOR');
