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
import { costingRouter } from './modules/costing/costing.routes';
import { staffRouter } from './modules/staff/staff.routes';
import { crmRouter, leadsPublicRouter } from './modules/crm/crm.routes';
import { importAlumnosRouter } from './modules/admin/importAlumnos';
import { contractsAdminRouter, contractsPortalRouter } from './modules/contracts/contracts.routes';
import { remindersRouter } from './modules/reminders/reminders.routes';
import { checkInRouter } from './modules/checkin/checkin.routes';
import { salonPublicRouter } from './modules/salon/salon.routes';
import { guestsPublicRouter } from './modules/guests/guests.public.routes';
import { guestsPortalRouter } from './modules/guests/guests.portal.routes';
import { guestsAdminRouter } from './modules/guests/guests.admin.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import {
  providersAdminRouter,
  providersPortalRouter,
  providersPublicRouter,
} from './modules/providers/providers.routes';
import { startReminderCron } from './jobs/reminderCron';
import { startIpcCron } from './jobs/ipcCron';
import { storageDriver } from './lib/storage';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

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
  apiRouter.use('/admin', costingRouter);
  apiRouter.use('/admin', staffRouter);
  apiRouter.use('/admin', crmRouter);
  apiRouter.use('/admin', importAlumnosRouter);
  apiRouter.use('/admin', contractsAdminRouter);
  apiRouter.use('/portal', contractsPortalRouter);
  apiRouter.use('/admin', remindersRouter);
  apiRouter.use('/checkin', checkInRouter);
  apiRouter.use('/public', salonPublicRouter);
  apiRouter.use('/public', guestsPublicRouter);
  apiRouter.use('/portal', guestsPortalRouter);
  apiRouter.use('/admin', guestsAdminRouter);
  apiRouter.use('/admin', auditRouter);
  apiRouter.use('/admin', reportsRouter);
  apiRouter.use('/admin', providersAdminRouter);
  apiRouter.use('/public', providersPublicRouter);
  apiRouter.use('/portal', providersPortalRouter);
  apiRouter.use(leadsPublicRouter);
  app.use('/api/v1', apiRouter);

  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createApp();
  // Solo cuando el server corre de verdad — no al importar createApp() desde
  // los tests, que no necesitan (ni quieren) un cron corriendo en paralelo.
  startReminderCron();
  startIpcCron();
  app.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT}`);
    console.log(
      `Entorno: ${env.NODE_ENV} · storage: ${storageDriver} · CORS: ${env.WEB_ORIGIN.join(', ')}`,
    );
  });
}
