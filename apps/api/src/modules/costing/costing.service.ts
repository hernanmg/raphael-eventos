import { randomBytes } from 'node:crypto';
import type {
  CostCategoryInput,
  CostCategorySummary,
  CostingCategoryGroup,
  EventCostingSummary,
  ExpenseCategoryTotal,
  ExpenseInput,
  ExpenseList,
  ExpenseSummary,
  FixedCostProration,
  TenantCostConfigInput,
  TenantCostConfigSummary,
} from '@raphael-eventos/shared';
import type { CostCategoryKind, Prisma } from '@prisma/client';
import { withTenant } from '../../db/withTenant';
import { audit, diffFields, money, snapshot } from '../../lib/audit';
import { receiptStorage } from '../../lib/storage';
import { detectLogoMime } from '../providers/providers.service';

/**
 * Costeo (Plan Pro) — rediseño de octubre 2026 (feedback de uso real, ver
 * CLAUDE.md). El costo de un evento sale de GASTOS reales (`Expense`, con
 * ticket e ítems opcionales), agrupados por rubro → proveedor → ítems como
 * la hoja PRECIOS. de Fede, más el prorrateo de los gastos del salón del mes
 * y los impuestos bancarios. Nada se snapshotea: se calcula en cada request.
 */

export class NotFoundError extends Error {}
export class InvalidExpenseError extends Error {}

const DEFAULT_COST_CONFIG = {
  gananciaPct: 0.4,
  roturaPct: 0.15,
  ivaPct: 0.21,
  insumoRenegotiationPct: 0.1,
  advanceDepositCapPct: 0.3,
  bankCreditTaxPct: 0.0006,
  bankDebitTaxPct: 0.0006,
  bankTransferFee: 1000,
};

const CONFIG_FIELDS = [
  'gananciaPct',
  'roturaPct',
  'ivaPct',
  'insumoRenegotiationPct',
  'advanceDepositCapPct',
  'bankCreditTaxPct',
  'bankDebitTaxPct',
  'bankTransferFee',
] as const;

function round2(n: number): number {
  return Number(n.toFixed(2));
}

async function loadConfig(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.tenantCostConfig.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, ...DEFAULT_COST_CONFIG },
  });
}

function serializeCostConfig(
  row: Record<(typeof CONFIG_FIELDS)[number], Prisma.Decimal>,
): TenantCostConfigSummary {
  return {
    gananciaPct: Number(row.gananciaPct),
    roturaPct: Number(row.roturaPct),
    ivaPct: Number(row.ivaPct),
    insumoRenegotiationPct: Number(row.insumoRenegotiationPct),
    advanceDepositCapPct: Number(row.advanceDepositCapPct),
    bankCreditTaxPct: Number(row.bankCreditTaxPct),
    bankDebitTaxPct: Number(row.bankDebitTaxPct),
    bankTransferFee: Number(row.bankTransferFee),
  };
}

export async function getCostConfig(tenantId: string): Promise<TenantCostConfigSummary> {
  return withTenant(tenantId, async (tx) => serializeCostConfig(await loadConfig(tx, tenantId)));
}

export async function updateCostConfig(
  tenantId: string,
  input: TenantCostConfigInput,
): Promise<TenantCostConfigSummary> {
  return withTenant(tenantId, async (tx) => {
    const before = await tx.tenantCostConfig.findUnique({ where: { tenantId } });
    const row = await tx.tenantCostConfig.upsert({
      where: { tenantId },
      update: input,
      create: { tenantId, ...input },
    });
    const changes = diffFields(before ?? { ...DEFAULT_COST_CONFIG }, input, [...CONFIG_FIELDS]);
    if (changes) {
      await audit(tx, tenantId, {
        entityType: 'TenantCostConfig',
        entityId: row.id,
        action: 'UPDATE',
        summary: 'Cambio en la configuración de costeo',
        changes,
      });
    }
    return serializeCostConfig(row);
  });
}

// -- Rubros (catálogo único) --------------------------------------------------

const KIND_ORDER: Record<CostCategoryKind, number> = { INSUMO: 0, SERVICIO: 1, FIJO: 2 };
const KIND_LABEL: Record<CostCategoryKind, string> = {
  INSUMO: 'insumo',
  SERVICIO: 'servicio',
  FIJO: 'gasto fijo',
};

function serializeCategory(row: {
  id: string;
  kind: CostCategoryKind;
  name: string;
  sortOrder: number;
  monthlyAmount: Prisma.Decimal;
  guestScaled: boolean;
}): CostCategorySummary {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    sortOrder: row.sortOrder,
    monthlyAmount: Number(row.monthlyAmount),
    guestScaled: row.guestScaled,
  };
}

export async function listCostCategories(tenantId: string): Promise<CostCategorySummary[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.costCategory.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(serializeCategory).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  });
}

const CATEGORY_FIELDS = ['kind', 'name', 'sortOrder', 'monthlyAmount', 'guestScaled'] as const;

export async function createCostCategory(tenantId: string, input: CostCategoryInput) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.costCategory.create({ data: { tenantId, ...input } });
    await audit(tx, tenantId, {
      entityType: 'CostCategory',
      entityId: row.id,
      action: 'CREATE',
      summary: `Alta del rubro de ${KIND_LABEL[row.kind]} "${row.name}"`,
      changes: snapshot(row, [...CATEGORY_FIELDS]),
    });
    return serializeCategory(row);
  });
}

export async function updateCostCategory(tenantId: string, id: string, input: CostCategoryInput) {
  return withTenant(tenantId, async (tx) => {
    const before = await tx.costCategory.findUnique({ where: { id } });
    if (!before || before.tenantId !== tenantId) throw new NotFoundError();
    const row = await tx.costCategory.update({ where: { id }, data: input });
    // El nombre del rubro está desnormalizado en el proveedor (listado público).
    if (before.name !== row.name) {
      await tx.provider.updateMany({
        where: { tenantId, costCategoryId: id },
        data: { category: row.name },
      });
    }
    const changes = diffFields(before, input, [...CATEGORY_FIELDS]);
    if (changes) {
      await audit(tx, tenantId, {
        entityType: 'CostCategory',
        entityId: id,
        action: 'UPDATE',
        summary: `Cambio en el rubro de ${KIND_LABEL[row.kind]} "${row.name}"`,
        changes,
      });
    }
    return serializeCategory(row);
  });
}

/** Un rubro con gastos no se puede borrar (FK RESTRICT → 409 "está en uso"). */
export async function deleteCostCategory(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.costCategory.delete({ where: { id } });
    await audit(tx, tenantId, {
      entityType: 'CostCategory',
      entityId: id,
      action: 'DELETE',
      summary: `Baja del rubro de ${KIND_LABEL[row.kind]} "${row.name}"`,
      changes: snapshot(row, [...CATEGORY_FIELDS]),
    });
  });
}

// -- Gastos -------------------------------------------------------------------

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

const EXPENSE_INCLUDE = {
  items: { orderBy: { sortOrder: 'asc' } },
  category: true,
  provider: { select: { name: true } },
  employee: { select: { fullName: true } },
  event: { select: { name: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function parsePeriod(period: string): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
}

function formatPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Alerta de renegociación por ítem: compara el precio unitario contra la
 * compra más reciente del mismo producto en OTRO gasto. Solo informativa
 * (decisión cerrada: nunca bloquea nada).
 */
async function itemWarnings(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rows: ExpenseRow[],
  thresholdPct: number,
): Promise<Set<string>> {
  const flagged = new Set<string>();
  for (const row of rows) {
    for (const item of row.items) {
      const previous = await tx.expenseItem.findFirst({
        where: {
          tenantId,
          productName: { equals: item.productName, mode: 'insensitive' },
          expenseId: { not: row.id },
          expense: { date: { lte: row.date } },
        },
        orderBy: { expense: { date: 'desc' } },
      });
      if (!previous) continue;
      const prevCost = Number(previous.unitCost);
      if (prevCost > 0 && Math.abs(Number(item.unitCost) - prevCost) / prevCost > thresholdPct) {
        flagged.add(item.id);
      }
    }
  }
  return flagged;
}

function serializeExpense(row: ExpenseRow, warnings: Set<string>): ExpenseSummary {
  return {
    id: row.id,
    eventId: row.eventId,
    eventName: row.event?.name ?? null,
    period: row.period ? formatPeriod(row.period) : null,
    date: row.date.toISOString(),
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categoryKind: row.category?.kind ?? null,
    providerId: row.providerId,
    providerName: row.provider?.name ?? null,
    employeeId: row.employeeId,
    employeeName: row.employee?.fullName ?? null,
    amount: Number(row.amount),
    detail: row.detail,
    autoSource: row.autoSource,
    manuallyEdited: row.manuallyEdited,
    receiptName: row.receiptKey ? (row.receiptName ?? 'ticket') : null,
    items: row.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      return {
        id: item.id,
        productName: item.productName,
        presentation: item.presentation,
        quantity,
        unit: item.unit,
        unitCost,
        lineCost: round2(quantity * unitCost),
        renegotiationWarning: warnings.has(item.id),
      };
    }),
  };
}

async function serializeExpenses(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rows: ExpenseRow[],
): Promise<ExpenseSummary[]> {
  const config = await loadConfig(tx, tenantId);
  const warnings = await itemWarnings(tx, tenantId, rows, Number(config.insumoRenegotiationPct));
  return rows.map((row) => serializeExpense(row, warnings));
}

/** Nombre del grupo para gastos sin rubro (los genera el sistema). */
function fallbackCategoryName(row: { autoSource: string | null }): string {
  if (row.autoSource === 'SALE_COMMISSION') return 'Comisiones de venta';
  if (row.autoSource === 'STAFF_EVENT' || row.autoSource === 'PAYROLL') return 'Personal';
  return 'Sin rubro';
}

function byKindThenName(
  a: { kind: CostCategoryKind | null; categoryName: string },
  b: { kind: CostCategoryKind | null; categoryName: string },
) {
  return (
    (a.kind ? KIND_ORDER[a.kind] : 3) - (b.kind ? KIND_ORDER[b.kind] : 3) ||
    a.categoryName.localeCompare(b.categoryName)
  );
}

function totalsByCategory(expenses: ExpenseSummary[]): ExpenseCategoryTotal[] {
  const map = new Map<string, ExpenseCategoryTotal>();
  for (const e of expenses) {
    const name = e.categoryName ?? fallbackCategoryName(e);
    const key = e.categoryId ?? `auto:${name}`;
    const entry = map.get(key) ?? {
      categoryId: e.categoryId,
      categoryName: name,
      kind: e.categoryKind,
      total: 0,
      count: 0,
    };
    entry.total = round2(entry.total + e.amount);
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort(byKindThenName);
}

/**
 * Listado de gastos: de un evento (`eventId`), o de un mes (`month` =
 * "YYYY-MM": los gastos de eventos con fecha en ese mes + los del salón de
 * ese período), con los totales por rubro.
 */
export async function listExpenses(
  tenantId: string,
  filter: { eventId?: string; month?: string; categoryId?: string },
): Promise<ExpenseList> {
  return withTenant(tenantId, async (tx) => {
    const where: Prisma.ExpenseWhereInput = { tenantId };
    if (filter.eventId) where.eventId = filter.eventId;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.month) {
      const start = parsePeriod(filter.month);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      where.OR = [
        { eventId: { not: null }, date: { gte: start, lt: end } },
        { eventId: null, period: start },
      ];
    }
    const rows = await tx.expense.findMany({
      where,
      include: EXPENSE_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    const expenses = await serializeExpenses(tx, tenantId, rows);
    return {
      expenses,
      byCategory: totalsByCategory(expenses),
      total: round2(expenses.reduce((s, e) => s + e.amount, 0)),
    };
  });
}

export interface ReceiptUpload {
  buffer: Buffer;
  originalName: string;
}

function detectReceiptMime(buffer: Buffer): string | null {
  if (buffer.length > 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }
  return detectLogoMime(buffer);
}

const RECEIPT_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Guarda el ticket ANTES de la transacción (mismo criterio que contratos:
 *  el archivo viejo se borra recién después del commit). Tipo verificado por
 *  los bytes reales, no por el mimetype que manda el navegador. */
async function storeReceipt(tenantId: string, receipt: ReceiptUpload) {
  if (receipt.buffer.length > RECEIPT_MAX_BYTES) {
    throw new InvalidExpenseError('El ticket no puede pesar más de 10 MB');
  }
  const mime = detectReceiptMime(receipt.buffer);
  if (!mime) {
    throw new InvalidExpenseError('El ticket tiene que ser una foto (JPG, PNG, WEBP) o un PDF');
  }
  const key = `${tenantId}/${randomBytes(12).toString('hex')}.${RECEIPT_EXT[mime]}`;
  await receiptStorage.save(key, receipt.buffer, mime);
  return { key, mime, name: receipt.originalName.slice(0, 200) || `ticket.${RECEIPT_EXT[mime]}` };
}

async function assertReferences(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: ExpenseInput,
) {
  if (input.eventId) {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.tenantId !== tenantId) throw new InvalidExpenseError('Evento inválido');
  }
  const category = await tx.costCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || category.tenantId !== tenantId) throw new InvalidExpenseError('Rubro inválido');
  if (input.providerId) {
    const provider = await tx.provider.findUnique({ where: { id: input.providerId } });
    if (!provider || provider.tenantId !== tenantId) {
      throw new InvalidExpenseError('Proveedor inválido');
    }
  }
}

function expenseData(input: ExpenseInput) {
  const amount =
    input.items.length > 0
      ? round2(input.items.reduce((s, i) => s + round2(i.quantity * i.unitCost), 0))
      : input.amount!;
  return {
    eventId: input.eventId ?? null,
    period: input.period ? parsePeriod(input.period) : null,
    date: new Date(input.date),
    categoryId: input.categoryId,
    providerId: input.providerId ?? null,
    amount,
    detail: input.detail ?? null,
  };
}

function itemRows(tenantId: string, input: ExpenseInput) {
  return input.items.map((item, index) => ({
    tenantId,
    productName: item.productName,
    presentation: item.presentation ?? null,
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    sortOrder: index,
  }));
}

const AUDIT_FIELDS = [
  'eventId',
  'period',
  'date',
  'categoryId',
  'providerId',
  'amount',
  'detail',
] as const;

export async function createExpense(
  tenantId: string,
  input: ExpenseInput,
  receipt: ReceiptUpload | null,
  createdById: string | null,
): Promise<ExpenseSummary> {
  const stored = receipt ? await storeReceipt(tenantId, receipt) : null;
  try {
    return await withTenant(tenantId, async (tx) => {
      await assertReferences(tx, tenantId, input);
      const row = await tx.expense.create({
        data: {
          tenantId,
          ...expenseData(input),
          createdById,
          receiptKey: stored?.key ?? null,
          receiptName: stored?.name ?? null,
          receiptMimeType: stored?.mime ?? null,
          items: { create: itemRows(tenantId, input) },
        },
        include: EXPENSE_INCLUDE,
      });
      await audit(tx, tenantId, {
        entityType: 'Expense',
        entityId: row.id,
        eventId: row.eventId,
        action: 'CREATE',
        summary: `Gasto ${row.category?.name ?? ''}${row.provider ? ` (${row.provider.name})` : ''} por ${money(row.amount)}`,
        changes: {
          ...snapshot(row, [...AUDIT_FIELDS]),
          items: row.items.length,
          ticket: Boolean(stored),
        },
      });
      return (await serializeExpenses(tx, tenantId, [row]))[0]!;
    });
  } catch (err) {
    if (stored) await receiptStorage.delete(stored.key).catch(() => undefined);
    throw err;
  }
}

export async function updateExpense(
  tenantId: string,
  id: string,
  input: ExpenseInput,
  receipt: ReceiptUpload | null,
): Promise<ExpenseSummary> {
  const stored = receipt ? await storeReceipt(tenantId, receipt) : null;
  let oldKey: string | null = null;
  try {
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.expense.findUnique({ where: { id } });
      if (!before || before.tenantId !== tenantId) throw new NotFoundError();
      if (before.autoSource === 'PAYROLL') {
        throw new InvalidExpenseError(
          'Este gasto sale de una liquidación: se corrige re-liquidando el mes del empleado',
        );
      }
      await assertReferences(tx, tenantId, input);
      const replaceReceipt = Boolean(stored) || input.removeReceipt;
      if (replaceReceipt) oldKey = before.receiptKey;
      await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      const data = expenseData(input);
      const row = await tx.expense.update({
        where: { id },
        data: {
          ...data,
          // Un gasto generado por el sistema (personal) editado a mano no se
          // vuelve a pisar automáticamente.
          manuallyEdited: before.autoSource ? true : before.manuallyEdited,
          ...(replaceReceipt
            ? {
                receiptKey: stored?.key ?? null,
                receiptName: stored?.name ?? null,
                receiptMimeType: stored?.mime ?? null,
              }
            : {}),
          items: { create: itemRows(tenantId, input) },
        },
        include: EXPENSE_INCLUDE,
      });
      const changes = diffFields(before, data, [...AUDIT_FIELDS]);
      await audit(tx, tenantId, {
        entityType: 'Expense',
        entityId: id,
        eventId: row.eventId,
        action: 'UPDATE',
        summary: `Cambio en el gasto ${row.category?.name ?? ''} (${money(row.amount)})`,
        changes: { ...(changes ?? {}), items: row.items.length, ticketReemplazado: replaceReceipt },
      });
      return (await serializeExpenses(tx, tenantId, [row]))[0]!;
    });
    if (oldKey) await receiptStorage.delete(oldKey).catch(() => undefined);
    return result;
  } catch (err) {
    if (stored) await receiptStorage.delete(stored.key).catch(() => undefined);
    throw err;
  }
}

export async function deleteExpense(tenantId: string, id: string) {
  const key = await withTenant(tenantId, async (tx) => {
    const row = await tx.expense.findUnique({ where: { id }, include: { category: true } });
    if (!row || row.tenantId !== tenantId) throw new NotFoundError();
    if (row.autoSource === 'PAYROLL') {
      throw new InvalidExpenseError(
        'Este gasto sale de una liquidación: se corrige re-liquidando el mes del empleado',
      );
    }
    await tx.expense.delete({ where: { id } });
    await audit(tx, tenantId, {
      entityType: 'Expense',
      entityId: id,
      eventId: row.eventId,
      action: 'DELETE',
      summary: `Baja del gasto ${row.category?.name ?? ''} de ${money(row.amount)}`,
      changes: snapshot(row, [...AUDIT_FIELDS]),
    });
    return row.receiptKey;
  });
  if (key) await receiptStorage.delete(key).catch(() => undefined);
}

export async function getExpenseReceipt(tenantId: string, id: string) {
  const row = await withTenant(tenantId, (tx) => tx.expense.findUnique({ where: { id } }));
  if (!row || row.tenantId !== tenantId || !row.receiptKey) throw new NotFoundError();
  return {
    buffer: await receiptStorage.read(row.receiptKey),
    mime: row.receiptMimeType ?? 'application/octet-stream',
    name: row.receiptName ?? 'ticket',
  };
}

// -- Costeo del evento --------------------------------------------------------

function groupForEvent(expenses: ExpenseSummary[]): CostingCategoryGroup[] {
  const groups = new Map<string, CostingCategoryGroup>();
  for (const e of expenses) {
    const name = e.categoryName ?? fallbackCategoryName(e);
    const key = e.categoryId ?? `auto:${name}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        categoryId: e.categoryId,
        categoryName: name,
        kind: e.categoryKind,
        total: 0,
        providers: [],
      };
      groups.set(key, group);
    }
    group.total = round2(group.total + e.amount);
    let provider = group.providers.find((p) => p.providerId === e.providerId);
    if (!provider) {
      provider = { providerId: e.providerId, providerName: e.providerName, total: 0, expenses: [] };
      group.providers.push(provider);
    }
    provider.total = round2(provider.total + e.amount);
    provider.expenses.push(e);
  }
  return [...groups.values()].sort(byKindThenName);
}

/**
 * Costeo de un evento (fórmula de Fede — porcentajes SUMADOS, decisión del
 * cliente 2026-10; antes la app los componía y daba ~11% más caro):
 *   neto    = Σ gastos del evento
 *             + Σ gastos del salón del mes / eventos del mes (un FIJO sin
 *               gastos reales cargados ese mes usa su monto estimado;
 *               guestScaled → además / (invitados/100))
 *             + impuestos bancarios (créditos + débitos sobre lo anterior,
 *               + monto fijo por transferencia)
 *   x100    = neto / (invitados / 100)
 *   tarjeta = x100 × (1 + ganancia + rotura + iva)
 */
export async function computeEventCosting(
  tenantId: string,
  eventId: string,
  guestCountOverride?: number,
): Promise<EventCostingSummary> {
  return withTenant(tenantId, async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event || event.tenantId !== tenantId) throw new NotFoundError();

    // Default de invitados: suma de las tarjetas cargadas (dato que ya existe).
    const guestCount =
      guestCountOverride ??
      (
        await tx.eventCard.aggregate({
          where: { tenantId, beneficiary: { eventId } },
          _sum: { quantity: true },
        })
      )._sum.quantity ??
      0;

    const month = monthStart(event.eventDate ?? event.createdAt);
    const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));

    const [eventRows, monthRows, fixedCategories, config, eventsInMonth] = await Promise.all([
      tx.expense.findMany({
        where: { tenantId, eventId },
        include: EXPENSE_INCLUDE,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.expense.findMany({
        where: { tenantId, eventId: null, period: month },
        include: { category: true },
      }),
      tx.costCategory.findMany({ where: { tenantId, kind: 'FIJO' }, orderBy: { name: 'asc' } }),
      loadConfig(tx, tenantId),
      tx.event.count({
        where: {
          tenantId,
          status: { not: 'CANCELADO' },
          eventDate: { gte: month, lt: nextMonth },
        },
      }),
    ]);

    const expenses = await serializeExpenses(tx, tenantId, eventRows);
    const totalExpenses = round2(expenses.reduce((s, e) => s + e.amount, 0));

    const monthCount = Math.max(eventsInMonth, 1);
    const prorate = (base: number, guestScaled: boolean) => {
      let amount = base / monthCount;
      if (guestScaled && guestCount > 0) amount = amount / (guestCount / 100);
      return round2(amount);
    };

    const fixedCostBreakdown: FixedCostProration[] = [];
    for (const category of fixedCategories) {
      const real = monthRows.filter((r) => r.categoryId === category.id);
      const source = real.length > 0 ? 'REAL' : 'ESTIMADO';
      const base =
        source === 'REAL'
          ? round2(real.reduce((s, r) => s + Number(r.amount), 0))
          : Number(category.monthlyAmount);
      if (base === 0) continue;
      fixedCostBreakdown.push({
        categoryId: category.id,
        categoryName: category.name,
        monthlyBase: base,
        source,
        guestScaled: category.guestScaled,
        proratedAmount: prorate(base, category.guestScaled),
      });
    }
    // Gastos del mes en rubros que no son FIJO (ej. la liquidación de un
    // empleado en su rubro): también se prorratean, siempre como REAL.
    const otherMonth = new Map<string, { name: string; id: string | null; base: number }>();
    for (const r of monthRows) {
      if (r.category?.kind === 'FIJO') continue;
      const name = r.category?.name ?? fallbackCategoryName(r);
      const key = r.categoryId ?? `auto:${name}`;
      const entry = otherMonth.get(key) ?? { name, id: r.categoryId, base: 0 };
      entry.base = round2(entry.base + Number(r.amount));
      otherMonth.set(key, entry);
    }
    for (const entry of otherMonth.values()) {
      fixedCostBreakdown.push({
        categoryId: entry.id,
        categoryName: entry.name,
        monthlyBase: entry.base,
        source: 'REAL',
        guestScaled: false,
        proratedAmount: prorate(entry.base, false),
      });
    }
    const totalFixedCostProrated = round2(
      fixedCostBreakdown.reduce((s, f) => s + f.proratedAmount, 0),
    );

    const cfg = serializeCostConfig(config);
    const subtotal = totalExpenses + totalFixedCostProrated;
    const creditDebit = round2(subtotal * (cfg.bankCreditTaxPct + cfg.bankDebitTaxPct));
    const transferFee = subtotal > 0 ? cfg.bankTransferFee : 0;
    const bankTotal = round2(creditDebit + transferFee);

    const costoNeto = round2(subtotal + bankTotal);
    const costoPor100Invitados = guestCount > 0 ? round2(costoNeto / (guestCount / 100)) : 0;
    const markupPct = Number((cfg.gananciaPct + cfg.roturaPct + cfg.ivaPct).toFixed(4));

    return {
      guestCount,
      eventsInMonth: monthCount,
      groups: groupForEvent(expenses),
      totalExpenses,
      fixedCostBreakdown,
      totalFixedCostProrated,
      bankTaxes: { creditDebit, transferFee, total: bankTotal },
      costoNeto,
      costoPor100Invitados,
      markupPct,
      costoTarjeta: round2(costoPor100Invitados * (1 + markupPct)),
    };
  });
}
