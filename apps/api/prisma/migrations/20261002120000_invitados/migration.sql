-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('CONFIRMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "GuestSource" AS ENUM ('AUTOGESTION', 'TITULAR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CheckInResult" AS ENUM ('ADMITIDO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "event_beneficiaries" ADD COLUMN     "inviteToken" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "photosUrl" TEXT,
ADD COLUMN     "startTime" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "address" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "rsvpCloseDaysBefore" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "whatsappNumber" TEXT;

-- CreateTable
CREATE TABLE "event_guests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "beneficiaryId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "GuestStatus" NOT NULL DEFAULT 'CONFIRMADO',
    "source" "GuestSource" NOT NULL,
    "lateEntry" BOOLEAN NOT NULL DEFAULT false,
    "qrToken" TEXT NOT NULL,
    "entryCode" TEXT NOT NULL,
    "createdById" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_checkins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "scannedById" TEXT NOT NULL,
    "result" "CheckInResult" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_guests_qrToken_key" ON "event_guests"("qrToken");

-- CreateIndex
CREATE INDEX "event_guests_tenantId_idx" ON "event_guests"("tenantId");

-- CreateIndex
CREATE INDEX "event_guests_tenantId_eventId_idx" ON "event_guests"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "event_guests_tenantId_beneficiaryId_idx" ON "event_guests"("tenantId", "beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "event_guests_eventId_entryCode_key" ON "event_guests"("eventId", "entryCode");

-- CreateIndex
CREATE INDEX "guest_checkins_tenantId_idx" ON "guest_checkins"("tenantId");

-- CreateIndex
CREATE INDEX "guest_checkins_tenantId_eventId_idx" ON "guest_checkins"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "guest_checkins_tenantId_guestId_idx" ON "guest_checkins"("tenantId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "event_beneficiaries_inviteToken_key" ON "event_beneficiaries"("inviteToken");

-- AddForeignKey
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "event_beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_checkins" ADD CONSTRAINT "guest_checkins_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_checkins" ADD CONSTRAINT "guest_checkins_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "event_guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_checkins" ADD CONSTRAINT "guest_checkins_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- NOTA: el diff generado incluía `DROP TABLE "session"` (drift conocido: la
-- tabla de express-session está versionada a mano en la migración inicial y
-- no en schema.prisma). Se quitó a mano — no borrar esa tabla.

-- ============================================================================
-- Row-Level Security — regla obligatoria de CLAUDE.md.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE "event_guests" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "event_guests" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "event_guests"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "event_guests" TO app_user;

  ALTER TABLE "guest_checkins" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "guest_checkins" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "guest_checkins"
    USING ("tenantId" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
  GRANT SELECT, INSERT, UPDATE, DELETE ON "guest_checkins" TO app_user;
END
$$;
