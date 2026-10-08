import type {
  ReminderConfigInput,
  ReminderConfigSummary,
  ReminderLogSummary,
  ReminderSweepResult,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { computeBeneficiaryFinancials } from '../../lib/financials';
import { whatsAppSender } from '../../lib/whatsapp';
import { prisma } from '../../db/prisma';

const DEFAULT_CONFIG = {
  enabled: false,
  channel: 'WHATSAPP' as const,
  cadenceDaysIfPendingBalance: 15,
  daysBeforeEventIfUnpaid: 7,
};

function serializeConfig(row: {
  enabled: boolean;
  channel: string;
  cadenceDaysIfPendingBalance: number;
  daysBeforeEventIfUnpaid: number;
}): ReminderConfigSummary {
  return {
    enabled: row.enabled,
    channel: 'WHATSAPP',
    cadenceDaysIfPendingBalance: row.cadenceDaysIfPendingBalance,
    daysBeforeEventIfUnpaid: row.daysBeforeEventIfUnpaid,
  };
}

export async function getReminderConfig(tenantId: string): Promise<ReminderConfigSummary> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.tenantReminderConfig.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, ...DEFAULT_CONFIG },
    });
    return serializeConfig(row);
  });
}

export async function updateReminderConfig(
  tenantId: string,
  input: ReminderConfigInput,
): Promise<ReminderConfigSummary> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.tenantReminderConfig.upsert({
      where: { tenantId },
      update: input,
      create: { tenantId, ...DEFAULT_CONFIG, ...input },
    });
    return serializeConfig(row);
  });
}

export async function listReminderLogs(tenantId: string): Promise<ReminderLogSummary[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.reminderLog.findMany({
      where: { tenantId },
      orderBy: { sentAt: 'desc' },
      take: 200,
      include: { beneficiary: { include: { event: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      beneficiaryLabel: row.beneficiary.label ?? row.beneficiary.event.name,
      eventName: row.beneficiary.event.name,
      channel: row.channel,
      message: row.message,
      status: row.status as ReminderLogSummary['status'],
      errorMessage: row.errorMessage,
      trigger: row.trigger as ReminderLogSummary['trigger'],
      sentAt: row.sentAt.toISOString(),
    }));
  });
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Recorre los beneficiaries del tenant con saldo pendiente y decide, uno por
 * uno, si corresponde mandarle un recordatorio — cadencia fija configurable
 * (ver CLAUDE.md "Fase 2 — recordatorios", decisión ya cerrada: sin plan de
 * cuotas/vencimientos nuevo). El teléfono sale de
 * EventBeneficiary.contactPhone (egreso) o Event.titularPhone (resto).
 */
export async function runReminderSweep(
  tenantId: string,
  trigger: 'MANUAL' | 'CRON',
): Promise<ReminderSweepResult> {
  return withTenant(tenantId, async (tx) => {
    const config = await tx.tenantReminderConfig.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, ...DEFAULT_CONFIG },
    });

    const [beneficiaries, ipcRows] = await Promise.all([
      tx.eventBeneficiary.findMany({
        // Fase 4: un evento cancelado/finalizado no genera recordatorios.
        where: { tenantId, event: { status: 'ACTIVO' } },
        include: { cards: true, payments: true, event: true },
      }),
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
    ]);

    const now = new Date();
    const result: ReminderSweepResult = { checked: 0, sent: 0, failed: 0, skipped: 0 };

    for (const beneficiary of beneficiaries) {
      const financials = computeBeneficiaryFinancials(beneficiary, ipcRows);
      if (financials.saldo <= 0) continue;
      result.checked += 1;

      const lastLog = await tx.reminderLog.findFirst({
        where: { tenantId, beneficiaryId: beneficiary.id },
        orderBy: { sentAt: 'desc' },
      });

      const eventDate = beneficiary.event.eventDate;
      const daysToEvent = eventDate ? daysBetween(eventDate, now) : null;
      const isFinalPush =
        daysToEvent !== null && daysToEvent >= 0 && daysToEvent <= config.daysBeforeEventIfUnpaid;
      const daysSinceLast = lastLog ? daysBetween(now, lastLog.sentAt) : null;
      const isDue =
        !lastLog ||
        isFinalPush ||
        (daysSinceLast !== null && daysSinceLast >= config.cadenceDaysIfPendingBalance);

      if (!isDue) continue;

      const phone = beneficiary.contactPhone || beneficiary.event.titularPhone;
      const label = beneficiary.label ?? beneficiary.event.titularName ?? 'Hola';
      const message = `${label}! Te recordamos que tenés un saldo pendiente de $${financials.saldo.toLocaleString('es-AR')} para "${beneficiary.event.name}"${
        eventDate ? ` (${eventDate.toLocaleDateString('es-AR')})` : ''
      }. Cualquier consulta, escribinos por acá.`;

      if (!phone) {
        result.skipped += 1;
        await tx.reminderLog.create({
          data: {
            tenantId,
            beneficiaryId: beneficiary.id,
            channel: 'WHATSAPP',
            message,
            status: 'SKIPPED',
            errorMessage: 'Sin teléfono cargado para este contacto',
            trigger,
          },
        });
        continue;
      }

      const sendResult = await whatsAppSender.send(phone, message);
      if (sendResult.ok) result.sent += 1;
      else result.failed += 1;

      await tx.reminderLog.create({
        data: {
          tenantId,
          beneficiaryId: beneficiary.id,
          channel: 'WHATSAPP',
          message,
          status: sendResult.ok ? 'SENT' : 'FAILED',
          errorMessage: sendResult.error ?? null,
          trigger,
        },
      });
    }

    return result;
  });
}

/** Usado por el cron (fuera de un request, sin req.tenantId) — itera todos
 *  los tenants con recordatorios habilitados. */
export async function runReminderSweepForAllTenants(): Promise<void> {
  const configs = await prisma.tenantReminderConfig.findMany({ where: { enabled: true } });
  for (const config of configs) {
    try {
      await runReminderSweep(config.tenantId, 'CRON');
    } catch (err) {
      console.error(`Error en el barrido de recordatorios del tenant ${config.tenantId}:`, err);
    }
  }
}
