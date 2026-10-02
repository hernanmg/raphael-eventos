import type {
  EventCostingSummary,
  EventServiceCostInput,
  EventSupplyLineInput,
  FixedCostCategoryInput,
  ServiceCostCategoryInput,
  SupplyCategoryInput,
  TenantCostConfigInput,
  TenantCostConfigSummary,
} from '@raphael-eventos/shared';
import type { Prisma } from '@prisma/client';
import { withTenant } from '../../db/withTenant';

export class NotFoundError extends Error {}

const DEFAULT_COST_CONFIG = {
  gananciaPct: 0.4,
  roturaPct: 0.15,
  ivaPct: 0.21,
  insumoRenegotiationPct: 0.1,
  advanceDepositCapPct: 0.3,
};

export async function getCostConfig(tenantId: string): Promise<TenantCostConfigSummary> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.tenantCostConfig.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, ...DEFAULT_COST_CONFIG },
    });
    return serializeCostConfig(row);
  });
}

export async function updateCostConfig(
  tenantId: string,
  input: TenantCostConfigInput,
): Promise<TenantCostConfigSummary> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.tenantCostConfig.upsert({
      where: { tenantId },
      update: input,
      create: { tenantId, ...input },
    });
    return serializeCostConfig(row);
  });
}

function serializeCostConfig(row: {
  gananciaPct: Prisma.Decimal;
  roturaPct: Prisma.Decimal;
  ivaPct: Prisma.Decimal;
  insumoRenegotiationPct: Prisma.Decimal;
  advanceDepositCapPct: Prisma.Decimal;
}): TenantCostConfigSummary {
  return {
    gananciaPct: Number(row.gananciaPct),
    roturaPct: Number(row.roturaPct),
    ivaPct: Number(row.ivaPct),
    insumoRenegotiationPct: Number(row.insumoRenegotiationPct),
    advanceDepositCapPct: Number(row.advanceDepositCapPct),
  };
}

// -- Catálogos configurables (rubros) ---------------------------------------

export async function listSupplyCategories(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.supplyCategory.findMany({ where: { tenantId }, orderBy: { sortOrder: 'asc' } }),
  );
}

export async function createSupplyCategory(tenantId: string, input: SupplyCategoryInput) {
  return withTenant(tenantId, (tx) => tx.supplyCategory.create({ data: { tenantId, ...input } }));
}

export async function deleteSupplyCategory(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => tx.supplyCategory.delete({ where: { id } }));
}

export async function listServiceCostCategories(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.serviceCostCategory.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
  );
}

export async function createServiceCostCategory(tenantId: string, input: ServiceCostCategoryInput) {
  return withTenant(tenantId, (tx) =>
    tx.serviceCostCategory.create({ data: { tenantId, ...input } }),
  );
}

export async function deleteServiceCostCategory(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => tx.serviceCostCategory.delete({ where: { id } }));
}

function serializeFixedCostCategory(row: {
  id: string;
  name: string;
  monthlyAmount: Prisma.Decimal;
  guestScaled: boolean;
}) {
  return {
    id: row.id,
    name: row.name,
    monthlyAmount: Number(row.monthlyAmount),
    guestScaled: row.guestScaled,
  };
}

export async function listFixedCostCategories(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.fixedCostCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return rows.map(serializeFixedCostCategory);
  });
}

export async function createFixedCostCategory(tenantId: string, input: FixedCostCategoryInput) {
  return withTenant(tenantId, async (tx) =>
    serializeFixedCostCategory(await tx.fixedCostCategory.create({ data: { tenantId, ...input } })),
  );
}

export async function updateFixedCostCategory(
  tenantId: string,
  id: string,
  input: FixedCostCategoryInput,
) {
  return withTenant(tenantId, async (tx) =>
    serializeFixedCostCategory(await tx.fixedCostCategory.update({ where: { id }, data: input })),
  );
}

export async function deleteFixedCostCategory(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => tx.fixedCostCategory.delete({ where: { id } }));
}

// -- Insumos y servicios por evento ------------------------------------------

/**
 * Compara contra la carga más reciente del mismo producto en el tenant
 * (excluyendo la propia línea, para poder recalcular en listados). Solo
 * informativo — decisión ya cerrada de no bloquear nada con esto.
 */
async function computeRenegotiationWarning(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productName: string,
  unitCost: number,
  excludeId: string | null,
  thresholdPct: number,
): Promise<boolean> {
  const previous = await tx.eventSupplyLine.findFirst({
    where: { tenantId, productName, id: excludeId ? { not: excludeId } : undefined },
    orderBy: { createdAt: 'desc' },
  });
  if (!previous) return false;
  const prevCost = Number(previous.unitCost);
  if (prevCost <= 0) return false;
  return Math.abs(unitCost - prevCost) / prevCost > thresholdPct;
}

async function serializeSupplyLine(
  tx: Prisma.TransactionClient,
  tenantId: string,
  line: {
    id: string;
    categoryId: string;
    category: { name: string };
    productName: string;
    quantity: Prisma.Decimal;
    unit: string;
    unitCost: Prisma.Decimal;
  },
  thresholdPct: number,
) {
  const quantity = Number(line.quantity);
  const unitCost = Number(line.unitCost);
  return {
    id: line.id,
    categoryId: line.categoryId,
    categoryName: line.category.name,
    productName: line.productName,
    quantity,
    unit: line.unit as 'KG' | 'LITROS' | 'UNIDAD',
    unitCost,
    lineCost: Number((quantity * unitCost).toFixed(2)),
    renegotiationWarning: await computeRenegotiationWarning(
      tx,
      tenantId,
      line.productName,
      unitCost,
      line.id,
      thresholdPct,
    ),
  };
}

async function getRenegotiationThreshold(tx: Prisma.TransactionClient, tenantId: string) {
  const config = await tx.tenantCostConfig.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, ...DEFAULT_COST_CONFIG },
  });
  return Number(config.insumoRenegotiationPct);
}

export async function createEventSupplyLine(
  tenantId: string,
  eventId: string,
  input: EventSupplyLineInput,
) {
  return withTenant(tenantId, async (tx) => {
    const line = await tx.eventSupplyLine.create({
      data: {
        tenantId,
        eventId,
        categoryId: input.categoryId,
        productName: input.productName,
        quantity: input.quantity,
        unit: input.unit,
        unitCost: input.unitCost,
      },
      include: { category: true },
    });
    const threshold = await getRenegotiationThreshold(tx, tenantId);
    return serializeSupplyLine(tx, tenantId, line, threshold);
  });
}

export async function updateEventSupplyLine(
  tenantId: string,
  id: string,
  input: EventSupplyLineInput,
) {
  return withTenant(tenantId, async (tx) => {
    const line = await tx.eventSupplyLine.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        productName: input.productName,
        quantity: input.quantity,
        unit: input.unit,
        unitCost: input.unitCost,
      },
      include: { category: true },
    });
    const threshold = await getRenegotiationThreshold(tx, tenantId);
    return serializeSupplyLine(tx, tenantId, line, threshold);
  });
}

export async function deleteEventSupplyLine(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => tx.eventSupplyLine.delete({ where: { id } }));
}

function serializeServiceCost(row: {
  id: string;
  categoryId: string | null;
  category: { name: string } | null;
  employeeId: string | null;
  employee: { fullName: string } | null;
  autoGenerated: boolean;
  amount: Prisma.Decimal;
  note: string | null;
}) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    employeeId: row.employeeId,
    employeeName: row.employee?.fullName ?? null,
    autoGenerated: row.autoGenerated,
    amount: Number(row.amount),
    note: row.note,
  };
}

export async function createEventServiceCost(
  tenantId: string,
  eventId: string,
  input: EventServiceCostInput,
) {
  return withTenant(tenantId, async (tx) =>
    serializeServiceCost(
      await tx.eventServiceCost.create({
        data: {
          tenantId,
          eventId,
          categoryId: input.categoryId ?? null,
          employeeId: input.employeeId ?? null,
          amount: input.amount,
          note: input.note ?? null,
        },
        include: { category: true, employee: { select: { fullName: true } } },
      }),
    ),
  );
}

export async function updateEventServiceCost(
  tenantId: string,
  id: string,
  input: EventServiceCostInput,
) {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.eventServiceCost.findUnique({ where: { id } });
    const updated = await tx.eventServiceCost.update({
      where: { id },
      data: {
        categoryId: input.categoryId ?? null,
        employeeId: input.employeeId ?? null,
        amount: input.amount,
        note: input.note ?? null,
        // Si era una línea auto-generada por una asignación de personal, un
        // ajuste manual del admin queda marcado para que una futura
        // desasignación no la pise (ver staff.service.ts).
        manuallyEdited: existing?.autoGenerated ? true : existing?.manuallyEdited,
      },
      include: { category: true, employee: { select: { fullName: true } } },
    });
    return serializeServiceCost(updated);
  });
}

export async function deleteEventServiceCost(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => tx.eventServiceCost.delete({ where: { id } }));
}

/**
 * Cálculo completo de costeo de un evento — ver la fórmula documentada en
 * CLAUDE.md "Fase 2 — costeo y personal":
 *   costo_neto = Σ insumos + Σ servicios + prorrateo(gastos fijos, invitados)
 *   costo_por_100 = costo_neto / (invitados / 100)
 *   costo_tarjeta = costo_por_100 × (1+ganancia) × (1+rotura) × (1+iva)
 */
export async function computeEventCosting(
  tenantId: string,
  eventId: string,
  guestCountOverride?: number,
): Promise<EventCostingSummary> {
  return withTenant(tenantId, async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event || event.tenantId !== tenantId) throw new NotFoundError();

    // Default: la cantidad de invitados sale de la suma de las tarjetas ya
    // cargadas al evento (todos los tipos, todos los beneficiaries) — es el
    // dato real que ya existe, no hay que volver a tipearlo. El admin puede
    // pisarlo con guestCountOverride si necesita simular otro escenario.
    const cardQuantitySum =
      guestCountOverride === undefined
        ? await tx.eventCard.aggregate({
            where: { tenantId, beneficiary: { eventId } },
            _sum: { quantity: true },
          })
        : null;
    const guestCount = guestCountOverride ?? cardQuantitySum?._sum.quantity ?? 0;

    const [supplyLines, serviceCosts, fixedCostCategories, config, eventsInMonth] =
      await Promise.all([
        tx.eventSupplyLine.findMany({
          where: { tenantId, eventId },
          include: { category: true },
          orderBy: { createdAt: 'asc' },
        }),
        tx.eventServiceCost.findMany({
          where: { tenantId, eventId },
          include: { category: true, employee: { select: { fullName: true } } },
          orderBy: { createdAt: 'asc' },
        }),
        tx.fixedCostCategory.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        tx.tenantCostConfig.upsert({
          where: { tenantId },
          update: {},
          create: { tenantId, ...DEFAULT_COST_CONFIG },
        }),
        event.eventDate
          ? tx.event.count({
              where: {
                tenantId,
                eventDate: {
                  gte: new Date(
                    Date.UTC(event.eventDate.getUTCFullYear(), event.eventDate.getUTCMonth(), 1),
                  ),
                  lt: new Date(
                    Date.UTC(
                      event.eventDate.getUTCFullYear(),
                      event.eventDate.getUTCMonth() + 1,
                      1,
                    ),
                  ),
                },
              },
            })
          : Promise.resolve(1),
      ]);

    const configSummary = serializeCostConfig(config);
    const thresholdPct = configSummary.insumoRenegotiationPct;

    const supplyLineSummaries = await Promise.all(
      supplyLines.map((line) => serializeSupplyLine(tx, tenantId, line, thresholdPct)),
    );

    const serviceCostSummaries = serviceCosts.map(serializeServiceCost);

    const totalSupplyCost = round2(supplyLineSummaries.reduce((sum, l) => sum + l.lineCost, 0));
    const totalServiceCost = round2(serviceCostSummaries.reduce((sum, s) => sum + s.amount, 0));

    const monthCount = Math.max(eventsInMonth, 1);
    const fixedCostBreakdown = fixedCostCategories.map((category) => {
      let proratedAmount = Number(category.monthlyAmount) / monthCount;
      if (category.guestScaled && guestCount > 0) {
        proratedAmount = proratedAmount / (guestCount / 100);
      }
      return { categoryName: category.name, proratedAmount: round2(proratedAmount) };
    });
    const totalFixedCostProrated = round2(
      fixedCostBreakdown.reduce((sum, f) => sum + f.proratedAmount, 0),
    );

    const costoNeto = round2(totalSupplyCost + totalServiceCost + totalFixedCostProrated);
    const costoPor100Invitados = guestCount > 0 ? round2(costoNeto / (guestCount / 100)) : 0;
    const costoTarjeta = round2(
      costoPor100Invitados *
        (1 + configSummary.gananciaPct) *
        (1 + configSummary.roturaPct) *
        (1 + configSummary.ivaPct),
    );

    return {
      guestCount,
      eventsInMonth: monthCount,
      supplyLines: supplyLineSummaries,
      serviceCosts: serviceCostSummaries,
      fixedCostBreakdown,
      totalSupplyCost,
      totalServiceCost,
      totalFixedCostProrated,
      costoNeto,
      costoPor100Invitados,
      costoTarjeta,
    };
  });
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
