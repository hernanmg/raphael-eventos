-- CreateTable
CREATE TABLE "event_contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_contracts_eventId_key" ON "event_contracts"("eventId");

-- CreateIndex
CREATE INDEX "event_contracts_tenantId_idx" ON "event_contracts"("tenantId");

-- AddForeignKey
ALTER TABLE "event_contracts" ADD CONSTRAINT "event_contracts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security — regla obligatoria de CLAUDE.md.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE "event_contracts" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "event_contracts" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "event_contracts"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "event_contracts" TO app_user;
END
$$;
