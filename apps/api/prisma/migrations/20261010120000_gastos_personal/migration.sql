-- Feedback de uso real (2026-10): costeo basado en gastos reales + personal
-- vinculado a costeo. Ver CLAUDE.md "Feedback de uso real (2026-10-09)".
--
--  * Un único catálogo de rubros (cost_categories, con `kind`) reemplaza
--    supply_categories / service_cost_categories / fixed_cost_categories.
--    Se conservan los ids (cuid, únicos entre las tres tablas).
--  * expenses + expense_items reemplazan event_supply_lines y
--    event_service_costs (los datos se migran: cada línea pasa a ser un gasto,
--    las de insumo con su ítem).
--  * La comisión % de un empleado pasa a ser comisión por evento VENDIDO
--    (decisión del cliente), no por evento trabajado.
--
-- Generado con `prisma migrate diff` (sin el DROP TABLE "session") + datos +
-- RLS a mano, en el orden necesario para no perder filas.

-- CreateEnum
CREATE TYPE "CostCategoryKind" AS ENUM ('INSUMO', 'SERVICIO', 'FIJO');
CREATE TYPE "ExpenseAutoSource" AS ENUM ('STAFF_EVENT', 'SALE_COMMISSION', 'PAYROLL');
CREATE TYPE "PayrollLineKind" AS ENUM ('FIJO', 'HORAS', 'POR_EVENTO', 'COMISION', 'ADELANTO', 'OTRO');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "costCategoryId" TEXT,
ADD COLUMN     "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saleCommissionType" "EmployeeVariableType" NOT NULL DEFAULT 'NINGUNO',
ADD COLUMN     "saleCommissionValue" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "events" ADD COLUMN     "soldAt" TIMESTAMP(3),
ADD COLUMN     "soldByEmployeeId" TEXT;

ALTER TABLE "providers" ADD COLUMN     "costCategoryId" TEXT,
ADD COLUMN     "showInDirectory" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tenant_cost_configs" ADD COLUMN     "bankCreditTaxPct" DECIMAL(6,5) NOT NULL DEFAULT 0.0006,
ADD COLUMN     "bankDebitTaxPct" DECIMAL(6,5) NOT NULL DEFAULT 0.0006,
ADD COLUMN     "bankTransferFee" DECIMAL(12,2) NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "cost_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "CostCategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "monthlyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "guestScaled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT,
    "period" TIMESTAMP(3),
    "date" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "providerId" TEXT,
    "employeeId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "detail" TEXT,
    "autoSource" "ExpenseAutoSource",
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "payrollEntryId" TEXT,
    "receiptKey" TEXT,
    "receiptName" TEXT,
    "receiptMimeType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "presentation" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "SupplyUnit" NOT NULL DEFAULT 'UNIDAD',
    "unitCost" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollEntryId" TEXT NOT NULL,
    "kind" "PayrollLineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_categories_tenantId_idx" ON "cost_categories"("tenantId");
CREATE UNIQUE INDEX "cost_categories_tenantId_kind_name_key" ON "cost_categories"("tenantId", "kind", "name");
CREATE UNIQUE INDEX "expenses_payrollEntryId_key" ON "expenses"("payrollEntryId");
CREATE INDEX "expenses_tenantId_idx" ON "expenses"("tenantId");
CREATE INDEX "expenses_tenantId_eventId_idx" ON "expenses"("tenantId", "eventId");
CREATE INDEX "expenses_tenantId_period_idx" ON "expenses"("tenantId", "period");
CREATE INDEX "expense_items_tenantId_idx" ON "expense_items"("tenantId");
CREATE INDEX "expense_items_tenantId_productName_idx" ON "expense_items"("tenantId", "productName");
CREATE INDEX "payroll_lines_tenantId_idx" ON "payroll_lines"("tenantId");

-- ---------------------------------------------------------------------------
-- Migración de datos
-- ---------------------------------------------------------------------------

-- Rubros: los tres catálogos → uno solo (mismos ids).
INSERT INTO "cost_categories" ("id", "tenantId", "kind", "name", "sortOrder")
SELECT "id", "tenantId", 'INSUMO', "name", "sortOrder" FROM "supply_categories";

INSERT INTO "cost_categories" ("id", "tenantId", "kind", "name")
SELECT "id", "tenantId", 'SERVICIO', "name" FROM "service_cost_categories";

INSERT INTO "cost_categories" ("id", "tenantId", "kind", "name", "monthlyAmount", "guestScaled")
SELECT "id", "tenantId", 'FIJO', "name", "monthlyAmount", "guestScaled" FROM "fixed_cost_categories";

-- Gastos de servicio de cada evento → gastos (mismo id).
INSERT INTO "expenses" (
  "id", "tenantId", "eventId", "date", "categoryId", "employeeId", "amount", "detail",
  "autoSource", "manuallyEdited", "createdAt", "updatedAt"
)
SELECT
  sc."id", sc."tenantId", sc."eventId", COALESCE(e."eventDate", sc."createdAt"),
  sc."categoryId", sc."employeeId", sc."amount", sc."note",
  CASE WHEN sc."autoGenerated" THEN 'STAFF_EVENT'::"ExpenseAutoSource" ELSE NULL END,
  sc."manuallyEdited", sc."createdAt", sc."createdAt"
FROM "event_service_costs" sc
JOIN "events" e ON e."id" = sc."eventId";

-- Líneas de insumo → un gasto por línea, con su ítem.
INSERT INTO "expenses" (
  "id", "tenantId", "eventId", "date", "categoryId", "amount", "detail", "createdAt", "updatedAt"
)
SELECT
  sl."id", sl."tenantId", sl."eventId", COALESCE(e."eventDate", sl."createdAt"),
  sl."categoryId", ROUND(sl."quantity" * sl."unitCost", 2), sl."productName",
  sl."createdAt", sl."createdAt"
FROM "event_supply_lines" sl
JOIN "events" e ON e."id" = sl."eventId";

INSERT INTO "expense_items" (
  "id", "tenantId", "expenseId", "productName", "quantity", "unit", "unitCost"
)
SELECT sl."id" || '_item', sl."tenantId", sl."id", sl."productName", sl."quantity", sl."unit", sl."unitCost"
FROM "event_supply_lines" sl;

-- Proveedores ya cargados: se vinculan al rubro de costeo del mismo nombre si
-- existe (servicio antes que insumo); si no, quedan sin rubro de costeo hasta
-- que se los edite (el texto de rubro se conserva).
UPDATE "providers" p SET "costCategoryId" = (
  SELECT c."id" FROM "cost_categories" c
  WHERE c."tenantId" = p."tenantId" AND c."kind" IN ('SERVICIO', 'INSUMO')
    AND lower(c."name") = lower(p."category")
  ORDER BY c."kind" DESC
  LIMIT 1
);

-- Comisión %: pasa a ser comisión por evento vendido (decisión del cliente).
UPDATE "employees"
SET "saleCommissionType" = 'COMISION_PCT', "saleCommissionValue" = "variableValue",
    "variableType" = 'NINGUNO', "variableValue" = 0
WHERE "variableType" = 'COMISION_PCT';

-- ---------------------------------------------------------------------------
-- Tablas viejas
-- ---------------------------------------------------------------------------
ALTER TABLE "event_service_costs" DROP CONSTRAINT "event_service_costs_categoryId_fkey";
ALTER TABLE "event_service_costs" DROP CONSTRAINT "event_service_costs_employeeId_fkey";
ALTER TABLE "event_service_costs" DROP CONSTRAINT "event_service_costs_eventId_fkey";
ALTER TABLE "event_supply_lines" DROP CONSTRAINT "event_supply_lines_categoryId_fkey";
ALTER TABLE "event_supply_lines" DROP CONSTRAINT "event_supply_lines_eventId_fkey";

DROP TABLE "event_service_costs";
DROP TABLE "event_supply_lines";
DROP TABLE "fixed_cost_categories";
DROP TABLE "service_cost_categories";
DROP TABLE "supply_categories";

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_soldByEmployeeId_fkey" FOREIGN KEY ("soldByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cost_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "payroll_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "payroll_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "providers" ADD CONSTRAINT "providers_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS (regla obligatoria: en la misma migración que crea la tabla)
-- ---------------------------------------------------------------------------
ALTER TABLE "cost_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cost_categories"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "cost_categories" TO app_user;

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expenses"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "expenses" TO app_user;

ALTER TABLE "expense_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expense_items"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "expense_items" TO app_user;

ALTER TABLE "payroll_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_lines"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "payroll_lines" TO app_user;
