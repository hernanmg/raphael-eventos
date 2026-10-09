-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "contactEmail" TEXT;


-- Sin tablas nuevas con tenantId: no hace falta bloque de RLS. Se quitó a
-- mano el DROP TABLE "session" del diff (drift conocido, ver CLAUDE.md).
