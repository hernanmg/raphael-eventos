-- Tarjetas base en todos los eventos (feedback 2026-10-23): todo evento tiene
-- Adulto, Adolescente y Menor. A los beneficiaries ya creados que no tengan
-- alguno se les agrega en 0 (cantidad y valor se completan con "Ajustar").
-- Período base = el más viejo de sus otras tarjetas (o el mes de alta del
-- evento). Sin cambios de schema; NO FORCE/FORCE porque FORCE RLS aplica
-- también al dueño.

ALTER TABLE "event_cards" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_beneficiaries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "events" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "event_cards" ("id", "tenantId", "beneficiaryId", "cardType", "quantity", "baseValue", "basePeriod", "createdAt", "updatedAt")
SELECT
  'base_' || md5(b."id" || t."cardType"),
  b."tenantId",
  b."id",
  t."cardType"::"CardType",
  0,
  0,
  COALESCE(
    (SELECT MIN(c."basePeriod") FROM "event_cards" c WHERE c."beneficiaryId" = b."id"),
    date_trunc('month', e."createdAt")
  ),
  NOW(),
  NOW()
FROM "event_beneficiaries" b
JOIN "events" e ON e."id" = b."eventId"
CROSS JOIN (VALUES ('ADULTO'), ('ADOLESCENTE'), ('MENOR')) AS t("cardType")
WHERE NOT EXISTS (
  SELECT 1 FROM "event_cards" c
  WHERE c."beneficiaryId" = b."id" AND c."cardType" = t."cardType"::"CardType"
);

ALTER TABLE "event_cards" FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_beneficiaries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
