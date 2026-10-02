-- CreateEnum
CREATE TYPE "SupplyUnit" AS ENUM ('KG', 'LITROS', 'UNIDAD');

-- AlterTable
ALTER TABLE "event_supply_lines" DROP COLUMN "presentation",
ADD COLUMN     "unit" "SupplyUnit" NOT NULL DEFAULT 'UNIDAD';
