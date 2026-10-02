-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NUEVO', 'CONTACTADO', 'CON_SENA', 'GANADO', 'PERDIDO');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "titularPhone" TEXT;

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "interestedDate" TIMESTAMP(3),
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NUEVO',
    "notes" TEXT,
    "convertedEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_tenantId_idx" ON "leads"("tenantId");

-- CreateIndex
CREATE INDEX "leads_tenantId_status_idx" ON "leads"("tenantId", "status");

-- CreateIndex
CREATE INDEX "leads_tenantId_interestedDate_idx" ON "leads"("tenantId", "interestedDate");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_convertedEventId_fkey" FOREIGN KEY ("convertedEventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security — regla obligatoria de CLAUDE.md.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "leads"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "leads" TO app_user;
END
$$;
