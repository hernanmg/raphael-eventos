import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Router } from 'express';
import { env } from './env';
import { tenantContext } from './middleware/tenantContext';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { portalRouter } from './modules/portal/portal.routes';
import { adminRouter } from './modules/admin/admin.routes';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json());

  app.use(
    session({
      store: new PgSession({
        conString: env.APP_DATABASE_URL,
        tableName: 'session',
        // La tabla la crea la migración (con sus GRANTs a app_user), no
        // connect-pg-simple en runtime — app_user no tiene privilegios de DDL.
        createTableIfMissing: false,
      }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
  });

  const apiRouter = Router();
  apiRouter.use(tenantContext);
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/portal', portalRouter);
  apiRouter.use('/admin', adminRouter);
  app.use('/api/v1', apiRouter);

  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT}`);
  });
}
