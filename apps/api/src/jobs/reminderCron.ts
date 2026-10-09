import cron from 'node-cron';
import { runReminderSweepForAllTenants } from '../modules/reminders/reminders.service';

/**
 * Corre una vez por día (09:00). Viable como cron in-process porque
 * apps/api es un servidor persistente (Railway/Render), no funciones
 * serverless — ver CLAUDE.md sección de deploy. Si el día de mañana se
 * necesita correr en más de una instancia, esto se movería a un cron
 * administrado por la plataforma que pegue a un endpoint interno en vez de
 * vivir en el proceso.
 */
export function startReminderCron(): void {
  // Hora de Argentina, no la del servidor (los PaaS corren en UTC: sin
  // esto, 9:00 UTC serían las 06:00 en Córdoba).
  cron.schedule(
    '0 9 * * *',
    () => {
      runReminderSweepForAllTenants().catch((err) => {
        console.error('Error corriendo el barrido diario de recordatorios:', err);
      });
    },
    { timezone: 'America/Argentina/Cordoba' },
  );
}
