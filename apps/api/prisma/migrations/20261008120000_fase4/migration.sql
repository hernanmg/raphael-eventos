-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "event_card_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "previousBaseValue" DECIMAL(12,2) NOT NULL,
    "newBaseValue" DECIMAL(12,2) NOT NULL,
    "previousBasePeriod" TIMESTAMP(3) NOT NULL,
    "newBasePeriod" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_card_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "instagramUrl" TEXT,
    "websiteUrl" TEXT,
    "eventTypes" "EventType"[],
    "referralPct" DECIMAL(5,2),
    "referralNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "linkUrl" TEXT,
    "logoKey" TEXT NOT NULL,
    "logoMime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventId" TEXT,
    "action" "AuditAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_card_adjustments_tenantId_idx" ON "event_card_adjustments"("tenantId");

-- CreateIndex
CREATE INDEX "event_card_adjustments_tenantId_cardId_idx" ON "event_card_adjustments"("tenantId", "cardId");

-- CreateIndex
CREATE INDEX "providers_tenantId_idx" ON "providers"("tenantId");

-- CreateIndex
CREATE INDEX "sponsors_tenantId_idx" ON "sponsors"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_eventId_idx" ON "audit_logs"("tenantId", "eventId");

-- AddForeignKey
ALTER TABLE "event_card_adjustments" ADD CONSTRAINT "event_card_adjustments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "event_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_card_adjustments" ADD CONSTRAINT "event_card_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- NOTA: se quitó a mano el `DROP TABLE "session"` del diff generado (drift
-- conocido, ver CLAUDE.md).

-- ============================================================================
-- Row-Level Security — regla obligatoria de CLAUDE.md.
-- audit_logs es APPEND-ONLY a nivel de base: app_user solo SELECT + INSERT,
-- sin UPDATE/DELETE — ni un bug de la app puede alterar el historial.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE "event_card_adjustments" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "event_card_adjustments" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "event_card_adjustments"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  -- También append-only: un ajuste es historia, se corrige con otro ajuste.
  GRANT SELECT, INSERT ON "event_card_adjustments" TO app_user;

  ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "providers" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "providers"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "providers" TO app_user;

  ALTER TABLE "sponsors" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "sponsors" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "sponsors"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "sponsors" TO app_user;

  ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "audit_logs"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT ON "audit_logs" TO app_user;
END
$$;
