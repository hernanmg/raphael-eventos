import type { EventType } from '@prisma/client';
import type { MonthReport, YearReport } from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { computeAggregateFinancials, serializeCard, type IpcRow } from '../../lib/financials';
import { MONEY_FMT, type ExportSheet } from '../../lib/exporter';

/**
 * Reportes operativos (Fase 4): consultas/agregaciones sobre lo que ya existe
 * (eventos, tarjetas, pagos, consultas del calendario) — sin tablas propias.
 * Informativos, no contables (misma línea que "sin pagos en la app"). Los
 * reportes de margen/costeo ya existen en el módulo Pro y no se repiten acá.
 */

const EVENT_TYPES: EventType[] = ['QUINCE', 'EGRESO', 'BODA', 'EMPRESARIAL'];
const TENTATIVE = ['NUEVO', 'CONTACTADO', 'CON_SENA'] as const;

function emptyByType(): Record<EventType, number> {
  return { QUINCE: 0, EGRESO: 0, BODA: 0, EMPRESARIAL: 0 };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** Índice IPC vigente en un mes: el último cargado con período ≤ ese mes. */
function indexAt(ipcRows: IpcRow[], year: number, month: number): number | null {
  const date = Date.UTC(year, month - 1, 1);
  let found: IpcRow | null = null;
  for (const row of ipcRows) {
    if (row.period.getTime() <= date) found = row;
  }
  return found ? Number(found.indexValue) : null;
}

export async function getYearReport(tenantId: string, year: number): Promise<YearReport> {
  return withTenant(tenantId, async (tx) => {
    const from = new Date(Date.UTC(year - 1, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));

    const [ipcRows, events, leads, payments] = await Promise.all([
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
      tx.event.findMany({
        where: { tenantId, eventDate: { gte: from, lt: to } },
        select: {
          type: true,
          status: true,
          eventDate: true,
          beneficiaries: { include: { cards: true, payments: true } },
        },
      }),
      tx.lead.findMany({
        where: {
          tenantId,
          status: { in: [...TENTATIVE] },
          interestedDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: to },
        },
        select: { interestedDate: true },
      }),
      tx.payment.findMany({
        where: { tenantId, paymentDate: { gte: from, lt: to } },
        select: { amount: true, paymentDate: true },
      }),
    ]);

    // Agregados por mes (clave "año-mes"), para este año y el anterior.
    type Bucket = {
      events: number;
      byType: Record<EventType, number>;
      cancelled: number;
      committed: number;
      collected: number;
      cashIn: number;
      tentative: number;
    };
    const buckets = new Map<string, Bucket>();
    const bucket = (key: string): Bucket => {
      let b = buckets.get(key);
      if (!b) {
        b = {
          events: 0,
          byType: emptyByType(),
          cancelled: 0,
          committed: 0,
          collected: 0,
          cashIn: 0,
          tentative: 0,
        };
        buckets.set(key, b);
      }
      return b;
    };

    for (const event of events) {
      if (!event.eventDate) continue;
      const b = bucket(monthKey(event.eventDate));
      if (event.status === 'CANCELADO') {
        b.cancelled += 1;
        continue;
      }
      b.events += 1;
      b.byType[event.type] += 1;
      const { totalValue, totalPaid } = computeAggregateFinancials(event.beneficiaries, ipcRows);
      b.committed += totalValue;
      b.collected += totalPaid;
    }
    for (const lead of leads) {
      if (lead.interestedDate) bucket(monthKey(lead.interestedDate)).tentative += 1;
    }
    for (const payment of payments) {
      bucket(monthKey(payment.paymentDate)).cashIn += Number(payment.amount);
    }

    const latestIpc = ipcRows.length ? ipcRows[ipcRows.length - 1]!.period : null;
    const months: MonthReport[] = [];
    const ipcFactors: (number | null)[] = [];
    for (let month = 1; month <= 12; month++) {
      const cur = bucket(`${year}-${month}`);
      const prev = bucket(`${year - 1}-${month}`);
      // Un mes posterior al último IPC publicado no tiene índice propio:
      // usar el último disponible subestimaría el ajuste — mejor "sin IPC".
      const published = latestIpc !== null && Date.UTC(year, month - 1, 1) <= latestIpc.getTime();
      const idxNow = published ? indexAt(ipcRows, year, month) : null;
      const idxPrev = indexAt(ipcRows, year - 1, month);
      const factor = idxNow !== null && idxPrev !== null ? idxNow / idxPrev : null;
      ipcFactors.push(factor === null ? null : Number(factor.toFixed(4)));
      months.push({
        month,
        events: cur.events,
        eventsByType: cur.byType,
        tentative: cur.tentative,
        cancelled: cur.cancelled,
        committed: round2(cur.committed),
        collectedForEvents: round2(cur.collected),
        cashIn: round2(cur.cashIn),
        previousYear: {
          events: prev.events,
          committed: round2(prev.committed),
          collectedForEvents: round2(prev.collected),
          cashIn: round2(prev.cashIn),
          cashInAdjusted: factor === null ? null : round2(prev.cashIn * factor),
        },
      });
    }

    const sum = (pick: (m: MonthReport) => number) =>
      round2(months.reduce((s, m) => s + pick(m), 0));
    const totalsByType = emptyByType();
    for (const m of months) for (const t of EVENT_TYPES) totalsByType[t] += m.eventsByType[t];
    const adjustedKnown = months.every((m) => m.previousYear.cashInAdjusted !== null);

    return {
      year,
      months,
      ipcFactors,
      totals: {
        events: sum((m) => m.events),
        eventsByType: totalsByType,
        tentative: sum((m) => m.tentative),
        cancelled: sum((m) => m.cancelled),
        committed: sum((m) => m.committed),
        collectedForEvents: sum((m) => m.collectedForEvents),
        cashIn: sum((m) => m.cashIn),
        previousYear: {
          events: sum((m) => m.previousYear.events),
          committed: sum((m) => m.previousYear.committed),
          collectedForEvents: sum((m) => m.previousYear.collectedForEvents),
          cashIn: sum((m) => m.previousYear.cashIn),
          cashInAdjusted: adjustedKnown ? sum((m) => m.previousYear.cashInAdjusted ?? 0) : null,
        },
      },
    };
  });
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function yearReportSheets(report: YearReport): ExportSheet<MonthReport>[] {
  const totalsRow = { ...report.totals, month: 0 } as MonthReport;
  return [
    {
      name: `Reporte ${report.year}`,
      rows: [...report.months, totalsRow],
      columns: [
        {
          header: 'Mes',
          value: (m) => (m.month === 0 ? 'TOTAL' : MONTH_NAMES[m.month - 1]!),
          width: 12,
        },
        { header: 'Eventos', value: (m) => m.events },
        { header: '15 años', value: (m) => m.eventsByType.QUINCE },
        { header: 'Egresos', value: (m) => m.eventsByType.EGRESO },
        { header: 'Bodas', value: (m) => m.eventsByType.BODA },
        { header: 'Empresariales', value: (m) => m.eventsByType.EMPRESARIAL },
        { header: 'Consultas tentativas', value: (m) => m.tentative, width: 20 },
        { header: 'Cancelados', value: (m) => m.cancelled },
        {
          header: 'Comprometido (valor actual)',
          value: (m) => m.committed,
          numFmt: MONEY_FMT,
          width: 26,
        },
        {
          header: 'Cobrado de esos eventos',
          value: (m) => m.collectedForEvents,
          numFmt: MONEY_FMT,
          width: 24,
        },
        { header: 'Cobranza del mes', value: (m) => m.cashIn, numFmt: MONEY_FMT, width: 18 },
        { header: `Eventos ${report.year - 1}`, value: (m) => m.previousYear.events },
        {
          header: `Cobranza ${report.year - 1} (nominal)`,
          value: (m) => m.previousYear.cashIn,
          numFmt: MONEY_FMT,
          width: 24,
        },
        {
          header: `Cobranza ${report.year - 1} ajustada por IPC`,
          value: (m) => m.previousYear.cashInAdjusted,
          numFmt: MONEY_FMT,
          width: 28,
        },
      ],
    },
  ];
}

// -- Listas exportables ---------------------------------------------------------

export async function eventsExportSheet(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [ipcRows, events] = await Promise.all([
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
      tx.event.findMany({
        where: { tenantId },
        include: { beneficiaries: { include: { cards: true, payments: true } } },
        orderBy: { eventDate: 'asc' },
      }),
    ]);
    const rows = events.map((e) => ({
      e,
      f: computeAggregateFinancials(e.beneficiaries, ipcRows),
    }));
    const sheet: ExportSheet<(typeof rows)[number]> = {
      name: 'Eventos',
      rows,
      columns: [
        { header: 'Evento', value: (r) => r.e.name, width: 32 },
        { header: 'Tipo', value: (r) => r.e.type },
        { header: 'Estado', value: (r) => r.e.status },
        { header: 'Fecha', value: (r) => r.e.eventDate?.toISOString().slice(0, 10) ?? null },
        { header: 'Titular', value: (r) => r.e.titularName, width: 24 },
        { header: 'Email titular', value: (r) => r.e.titularEmail, width: 28 },
        { header: 'Teléfono titular', value: (r) => r.e.titularPhone, width: 16 },
        { header: 'Mínimo invitados', value: (r) => r.e.minGuests },
        {
          header: 'Total (valor actual)',
          value: (r) => r.f.totalValue,
          numFmt: MONEY_FMT,
          width: 20,
        },
        { header: 'Cobrado', value: (r) => r.f.totalPaid, numFmt: MONEY_FMT, width: 16 },
        { header: 'Saldo', value: (r) => r.f.saldo, numFmt: MONEY_FMT, width: 16 },
        { header: '% abonado', value: (r) => r.f.percentPaid },
      ],
    };
    return sheet;
  });
}

export async function cardsExportSheet(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [ipcRows, cards] = await Promise.all([
      tx.ipcIndexValue.findMany({ where: { tenantId }, orderBy: { period: 'asc' } }),
      tx.eventCard.findMany({
        where: { tenantId },
        include: {
          beneficiary: {
            include: {
              event: { select: { name: true, eventDate: true, status: true } },
              payments: { include: { allocations: true } },
            },
          },
        },
      }),
    ]);
    const rows = cards
      .map((card) => {
        const paid = card.beneficiary.payments
          .flatMap((p) => p.allocations)
          .filter((a) => a.cardType === card.cardType)
          .reduce((s, a) => s + a.quantity, 0);
        return { card, summary: serializeCard(card, ipcRows, paid) };
      })
      .sort(
        (a, b) =>
          (a.card.beneficiary.event.eventDate?.getTime() ?? 0) -
          (b.card.beneficiary.event.eventDate?.getTime() ?? 0),
      );
    const sheet: ExportSheet<(typeof rows)[number]> = {
      name: 'Tarjetas',
      rows,
      columns: [
        { header: 'Evento', value: (r) => r.card.beneficiary.event.name, width: 32 },
        {
          header: 'Fecha',
          value: (r) => r.card.beneficiary.event.eventDate?.toISOString().slice(0, 10) ?? null,
        },
        { header: 'Estado', value: (r) => r.card.beneficiary.event.status },
        { header: 'Alumno/familia', value: (r) => r.card.beneficiary.label, width: 22 },
        { header: 'Tipo de tarjeta', value: (r) => r.card.cardType, width: 16 },
        { header: 'Cantidad', value: (r) => r.summary.quantity },
        { header: 'Pagas (asignadas)', value: (r) => r.summary.quantityPaid, width: 18 },
        {
          header: 'Valor base',
          value: (r) => Number(r.card.baseValue),
          numFmt: MONEY_FMT,
          width: 14,
        },
        { header: 'Período base', value: (r) => r.card.basePeriod.toISOString().slice(0, 7) },
        {
          header: 'Valor actual (IPC)',
          value: (r) => r.summary.unitValue,
          numFmt: MONEY_FMT,
          width: 18,
        },
        { header: 'Subtotal', value: (r) => r.summary.subtotal, numFmt: MONEY_FMT, width: 16 },
      ],
    };
    return sheet;
  });
}

export async function paymentsExportSheet(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const payments = await tx.payment.findMany({
      where: { tenantId },
      include: {
        allocations: true,
        beneficiary: { select: { label: true, event: { select: { name: true } } } },
        recordedBy: { select: { fullName: true } },
      },
      orderBy: { paymentDate: 'asc' },
    });
    const sheet: ExportSheet<(typeof payments)[number]> = {
      name: 'Pagos',
      rows: payments,
      columns: [
        { header: 'Fecha', value: (p) => p.paymentDate.toISOString().slice(0, 10) },
        { header: 'Evento', value: (p) => p.beneficiary.event.name, width: 32 },
        { header: 'Alumno/familia', value: (p) => p.beneficiary.label, width: 22 },
        { header: 'Monto', value: (p) => Number(p.amount), numFmt: MONEY_FMT, width: 16 },
        {
          header: 'Tarjetas que cubre',
          value: (p) => p.allocations.map((a) => `${a.quantity} ${a.cardType}`).join(', ') || null,
          width: 24,
        },
        { header: 'Nota', value: (p) => p.note, width: 28 },
        { header: 'Cargado por', value: (p) => p.recordedBy?.fullName ?? null, width: 20 },
      ],
    };
    return sheet;
  });
}

export class ReportEventNotFoundError extends Error {}

export async function guestsExportSheet(tenantId: string, eventId: string) {
  return withTenant(tenantId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { tenantId: true, name: true },
    });
    if (!event || event.tenantId !== tenantId) throw new ReportEventNotFoundError();
    const guests = await tx.eventGuest.findMany({
      where: { tenantId, eventId },
      include: {
        beneficiary: { select: { label: true } },
        checkIns: {
          where: { result: 'ADMITIDO' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    const sheet: ExportSheet<(typeof guests)[number]> = {
      name: 'Invitados',
      rows: guests,
      columns: [
        { header: 'Invitado', value: (g) => g.fullName, width: 28 },
        { header: 'Teléfono', value: (g) => g.phone, width: 16 },
        { header: 'Email', value: (g) => g.email, width: 26 },
        { header: 'Estado', value: (g) => g.status },
        { header: 'Origen', value: (g) => g.source },
        { header: 'Después de las 12', value: (g) => (g.lateEntry ? 'Sí' : 'No'), width: 18 },
        { header: 'Invitado de', value: (g) => g.beneficiary?.label ?? null, width: 22 },
        { header: 'Código', value: (g) => g.entryCode },
        { header: 'Ingresó', value: (g) => (g.checkIns.length > 0 ? 'Sí' : 'No') },
        { header: 'Primer ingreso', value: (g) => g.checkIns[0]?.createdAt ?? null, width: 20 },
      ],
    };
    return { sheet, eventName: event.name };
  });
}
