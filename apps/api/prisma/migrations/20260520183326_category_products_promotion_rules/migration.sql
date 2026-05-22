-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "rules" JSONB;
