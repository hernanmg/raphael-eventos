-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReminderTrigger" AS ENUM ('MANUAL', 'CRON');

-- CreateTable
CREATE TABLE "tenant_reminder_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "cadenceDaysIfPendingBalance" INTEGER NOT NULL DEFAULT 15,
    "daysBeforeEventIfUnpaid" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_reminder_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "errorMessage" TEXT,
    "trigger" "ReminderTrigger" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_reminder_configs_tenantId_key" ON "tenant_reminder_configs"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_reminder_configs_tenantId_idx" ON "tenant_reminder_configs"("tenantId");

-- CreateIndex
CREATE INDEX "reminder_logs_tenantId_idx" ON "reminder_logs"("tenantId");

-- CreateIndex
CREATE INDEX "reminder_logs_tenantId_beneficiaryId_idx" ON "reminder_logs"("tenantId", "beneficiaryId");

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "event_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security — regla obligatoria de CLAUDE.md.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_reminder_configs', 'reminder_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))',
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
  END LOOP;
END
$$;
