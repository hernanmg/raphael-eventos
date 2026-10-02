// Schemas y tipos de recordatorios automáticos — ver CLAUDE.md "Fase 2 —
// recordatorios".

import { z } from 'zod';

export const ReminderConfigInputSchema = z.object({
  enabled: z.coerce.boolean(),
  cadenceDaysIfPendingBalance: z.coerce.number().int().min(1).max(365),
  daysBeforeEventIfUnpaid: z.coerce.number().int().min(0).max(90),
});
export type ReminderConfigInput = z.infer<typeof ReminderConfigInputSchema>;

export interface ReminderConfigSummary {
  enabled: boolean;
  channel: 'WHATSAPP';
  cadenceDaysIfPendingBalance: number;
  daysBeforeEventIfUnpaid: number;
}

export interface ReminderLogSummary {
  id: string;
  beneficiaryLabel: string;
  eventName: string;
  channel: string;
  message: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  errorMessage: string | null;
  trigger: 'MANUAL' | 'CRON';
  sentAt: string;
}

export interface ReminderSweepResult {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
}
