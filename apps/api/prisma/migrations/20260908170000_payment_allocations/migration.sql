-- CreateTable
CREATE TABLE "payment_card_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_card_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_card_allocations_tenantId_idx" ON "payment_card_allocations"("tenantId");

-- CreateIndex
CREATE INDEX "payment_card_allocations_tenantId_paymentId_idx" ON "payment_card_allocations"("tenantId", "paymentId");

-- AddForeignKey
ALTER TABLE "payment_card_allocations" ADD CONSTRAINT "payment_card_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security — regla obligatoria de CLAUDE.md.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE "payment_card_allocations" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "payment_card_allocations" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "payment_card_allocations"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_card_allocations" TO app_user;
END
$$;
