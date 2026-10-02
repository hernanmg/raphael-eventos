import cron from 'node-cron';
import { runIpcAutoFetchForAllTenants } from '../lib/ipc';

/**
 * Corre una vez por día (08:00) — la serie de datos.gob.ar se actualiza una
 * vez por mes (día 14), pero chequear todos los días es lo más simple y
 * barato: la mayoría de los días no hay período nuevo y la función no hace
 * nada (ver runIpcAutoFetch). Mismo criterio que reminderCron.ts: solo
 * corre dentro de `if (require.main === module)` en index.ts.
 */
export function startIpcCron(): void {
  cron.schedule('0 8 * * *', () => {
    runIpcAutoFetchForAllTenants().catch((err) => {
      console.error('Error corriendo el fetch diario de IPC:', err);
    });
  });
}
