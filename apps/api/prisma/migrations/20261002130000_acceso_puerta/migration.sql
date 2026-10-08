-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PUERTA';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "email" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- NOTA: se quitó a mano el `DROP TABLE "session"` del diff generado (drift
-- conocido, ver CLAUDE.md). Sin tablas nuevas con tenantId en esta
-- migración: no hace falta bloque de RLS (employees/users ya lo tienen).
