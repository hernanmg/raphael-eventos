-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('BASICA', 'PRO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDEDOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('QUINCE', 'EGRESO', 'BODA', 'EMPRESARIAL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('ADULTO', 'ADOLESCENTE', 'MENOR', 'BRINDIS');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('TITULAR', 'PARTICIPANTE');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'BASICA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENTE',
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVO',
    "titularName" TEXT,
    "titularEmail" TEXT,
    "minGuests" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_beneficiaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "baseValue" DECIMAL(12,2) NOT NULL,
    "basePeriod" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipc_index_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "indexValue" DECIMAL(14,6) NOT NULL,
    "sourcePreviousValue" DECIMAL(14,6) NOT NULL,
    "sourceLatestValue" DECIMAL(14,6) NOT NULL,
    "triggeredById" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipc_index_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beneficiaryId" TEXT,
    "role" "AccountRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "events_tenantId_idx" ON "events"("tenantId");

-- CreateIndex
CREATE INDEX "events_tenantId_titularEmail_idx" ON "events"("tenantId", "titularEmail");

-- CreateIndex
CREATE INDEX "event_beneficiaries_tenantId_idx" ON "event_beneficiaries"("tenantId");

-- CreateIndex
CREATE INDEX "event_beneficiaries_tenantId_contactEmail_idx" ON "event_beneficiaries"("tenantId", "contactEmail");

-- CreateIndex
CREATE INDEX "event_cards_tenantId_idx" ON "event_cards"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "event_cards_beneficiaryId_cardType_key" ON "event_cards"("beneficiaryId", "cardType");

-- CreateIndex
CREATE INDEX "ipc_index_values_tenantId_idx" ON "ipc_index_values"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ipc_index_values_tenantId_period_key" ON "ipc_index_values"("tenantId", "period");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "event_accounts_tenantId_idx" ON "event_accounts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "event_accounts_eventId_userId_key" ON "event_accounts"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_tenantId_idx" ON "auth_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_purpose_idx" ON "auth_tokens"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_beneficiaries" ADD CONSTRAINT "event_beneficiaries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_beneficiaries" ADD CONSTRAINT "event_beneficiaries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_cards" ADD CONSTRAINT "event_cards_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "event_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipc_index_values" ADD CONSTRAINT "ipc_index_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipc_index_values" ADD CONSTRAINT "ipc_index_values_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "event_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_accounts" ADD CONSTRAINT "event_accounts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_accounts" ADD CONSTRAINT "event_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_accounts" ADD CONSTRAINT "event_accounts_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "event_beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Multi-tenancy: rol de aplicación + Row-Level Security
-- ----------------------------------------------------------------------------
-- app_user es el rol con el que corre el servidor en runtime (ver
-- apps/api/src/db/prisma.ts). No tiene BYPASSRLS ni privilegios de DDL: las
-- policies de abajo son lo único que decide qué filas puede ver/tocar.
--
-- Regla para toda migración futura que agregue una tabla con tenant_id: la
-- RLS y el GRANT correspondiente van EN LA MISMA migración que crea la tabla,
-- nunca en una migración posterior — ver CLAUDE.md.
--
-- IMPORTANTE: la contraseña de acá es un valor de desarrollo. Antes de
-- aplicar esta migración contra un ambiente real (staging/producción/
-- Supabase), rotarla con ALTER ROLE app_user WITH PASSWORD '<secreto real>'
-- y guardar ese secreto fuera del control de versiones.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'app_user_dev_only';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;

-- tenants: no lleva tenant_id (cada fila ES un tenant) y no lleva RLS. Solo
-- lectura para app_user — el alta de tenants es una tarea de operación, no
-- una request de la app.
GRANT SELECT ON "tenants" TO app_user;

-- Tablas con datos de tenant: RLS obligatoria + GRANT completo a app_user.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'events', 'event_beneficiaries', 'event_cards',
    'ipc_index_values', 'payments', 'event_accounts', 'auth_tokens'
  ]
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

-- ============================================================================
-- Tabla de sesiones (express-session / connect-pg-simple)
-- ----------------------------------------------------------------------------
-- Se versiona acá (no vía connect-pg-simple con createTableIfMissing) para
-- poder darle privilegios a app_user sin darle CREATE en el schema. Misma
-- estructura que connect-pg-simple crea por default. No lleva RLS: no hay
-- columna tenant_id (las queries siempre son por sid exacto, nunca listados
-- filtrados por tenant).
-- ============================================================================

CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS = FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");

GRANT SELECT, INSERT, UPDATE, DELETE ON "session" TO app_user;
