-- Feedback de Cami y Fede (2026-10-23). Ver CLAUDE.md "Feedback 2026-10-23".
--
--  * payment_card_allocations.unitValue: valor por tarjeta congelado al pagar
--    (una tarjeta paga deja de indexar por IPC). Las asignaciones existentes
--    se congelan al valor vigente hoy (mismo cálculo que lib/financials.ts#
--    indexFactor: índice más reciente / índice del período base de la
--    tarjeta), así ningún saldo cambia en el momento de migrar.
--  * expenses.stockSourceId: compras para stock y su uso en eventos.
--  * events.cancelledAt / cancellationReason / refundAmount: baja del evento.
--
-- Generado con `prisma migrate diff` (sin el DROP TABLE "session") + datos a
-- mano. Sin tablas nuevas: no hace falta RLS nuevo.

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "stockSourceId" TEXT;

-- AlterTable + datos. FORCE RLS aplica también al dueño de la tabla: sin
-- app.tenant_id (y con varios tenants) el UPDATE vería cero filas. Se apaga
-- el FORCE solo durante el UPDATE y se vuelve a prender.
ALTER TABLE "payment_card_allocations" ADD COLUMN     "unitValue" DECIMAL(12,2);

ALTER TABLE "payment_card_allocations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_cards" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "ipc_index_values" NO FORCE ROW LEVEL SECURITY;

UPDATE "payment_card_allocations" a
SET "unitValue" = ROUND(
  c."baseValue" * COALESCE(latest."indexValue" / NULLIF(base."indexValue", 0), 1),
  2
)
FROM "payments" p
JOIN "event_cards" c ON c."beneficiaryId" = p."beneficiaryId"
LEFT JOIN LATERAL (
  SELECT i."indexValue" FROM "ipc_index_values" i
  WHERE i."tenantId" = c."tenantId"
  ORDER BY i."period" DESC
  LIMIT 1
) latest ON TRUE
LEFT JOIN LATERAL (
  -- El período <= basePeriod más cercano; si no hay, el primero cargado.
  SELECT i."indexValue" FROM "ipc_index_values" i
  WHERE i."tenantId" = c."tenantId"
  ORDER BY (i."period" <= c."basePeriod") DESC,
           CASE WHEN i."period" <= c."basePeriod" THEN i."period" END DESC,
           i."period" ASC
  LIMIT 1
) base ON TRUE
WHERE a."paymentId" = p."id" AND c."cardType" = a."cardType";

-- Una asignación sin tarjeta del mismo tipo no debería existir (el alta lo
-- valida); por las dudas no se deja NULL.
UPDATE "payment_card_allocations" SET "unitValue" = 0 WHERE "unitValue" IS NULL;

ALTER TABLE "payment_card_allocations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_cards" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ipc_index_values" FORCE ROW LEVEL SECURITY;

ALTER TABLE "payment_card_allocations" ALTER COLUMN "unitValue" SET NOT NULL;

-- CreateIndex
CREATE INDEX "expenses_stockSourceId_idx" ON "expenses"("stockSourceId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_stockSourceId_fkey" FOREIGN KEY ("stockSourceId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
