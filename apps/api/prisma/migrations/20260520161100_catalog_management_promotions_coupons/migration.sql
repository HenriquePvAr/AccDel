-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('percent', 'fixed', 'combo');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "CommercialStatus" AS ENUM ('active', 'inactive', 'scheduled', 'expired');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "visible_on_digital_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visible_on_pos" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromotionDiscountType" NOT NULL,
    "discount_value" DECIMAL(10,2),
    "status" "CommercialStatus" NOT NULL DEFAULT 'inactive',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "channels" "ProductChannel"[] DEFAULT ARRAY[]::"ProductChannel"[],
    "product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponDiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "min_order_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "status" "CommercialStatus" NOT NULL DEFAULT 'inactive',
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "channels" "ProductChannel"[] DEFAULT ARRAY[]::"ProductChannel"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_store_id_status_idx" ON "promotions"("store_id", "status");

-- CreateIndex
CREATE INDEX "coupons_store_id_status_idx" ON "coupons"("store_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_store_id_code_key" ON "coupons"("store_id", "code");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
