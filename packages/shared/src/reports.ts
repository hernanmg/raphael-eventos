// Reportes operativos (Fase 4) — consultas sobre lo existente, sin tablas
// propias. Informativos, no contables. Ver CLAUDE.md "Fase 4".

import type { EventType } from './enums';

export interface MonthReport {
  /** 1..12 */
  month: number;
  /** Eventos confirmados (no cancelados) con fecha en el mes. */
  events: number;
  eventsByType: Record<EventType, number>;
  /** Consultas tentativas activas (NUEVO/CONTACTADO/CON_SENA) con fecha en el mes. */
  tentative: number;
  cancelled: number;
  /** Valor actual (IPC aplicado) de las tarjetas de los eventos del mes. */
  committed: number;
  /** Lo cobrado de esos mismos eventos (nominal). */
  collectedForEvents: number;
  /** Cobranza del mes por fecha de pago (nominal). */
  cashIn: number;
  previousYear: {
    events: number;
    committed: number;
    collectedForEvents: number;
    cashIn: number;
    /**
     * Cobranza del mismo mes del año anterior llevada a pesos de este año con
     * el IPC guardado (índice del mes este año / índice del mes el año
     * pasado). null si no hay IPC para alguno de los dos meses.
     */
    cashInAdjusted: number | null;
  };
}

export interface YearReport {
  year: number;
  months: MonthReport[];
  totals: Omit<MonthReport, 'month' | 'eventsByType'> & { eventsByType: Record<EventType, number> };
  /** Factor IPC usado por mes (para mostrar de dónde sale el ajuste). */
  ipcFactors: (number | null)[];
}
