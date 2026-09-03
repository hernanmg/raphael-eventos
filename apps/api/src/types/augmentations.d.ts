import 'express-session';
import type { User } from '@prisma/client';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Resuelto por el middleware tenantContext antes de cualquier ruta de /api/v1. */
      tenantId: string;
      /** Seteado por requireRole (no por requireAuth) — evita otra query en el handler. */
      currentUser?: User;
    }
  }
}

export {};
