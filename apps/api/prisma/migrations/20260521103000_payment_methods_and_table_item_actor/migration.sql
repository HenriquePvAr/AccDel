-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('manual', 'pix', 'picpay');

-- AlterTable
ALTER TABLE "table_session_items" ADD COLUMN "created_by_name" TEXT;

-- CreateTable
CREATE TABLE "payment_method_configs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "PaymentMethod",
    "provider" "PaymentProvider" NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "requires_receipt" BOOLEAN NOT NULL DEFAULT false,
    "auto_cash_entry" BOOLEAN NOT NULL DEFAULT true,
    "channels" "ProductChannel"[] NOT NULL DEFAULT ARRAY[]::"ProductChannel"[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "external_enabled" BOOLEAN NOT NULL DEFAULT false,
    "external_payment_id" TEXT,
    "qr_code_payload" TEXT,
    "qr_code_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_configs_store_id_name_key" ON "payment_method_configs"("store_id", "name");

-- CreateIndex
CREATE INDEX "payment_method_configs_store_id_active_sort_order_idx" ON "payment_method_configs"("store_id", "active", "sort_order");

-- AddForeignKey
ALTER TABLE "payment_method_configs" ADD CONSTRAINT "payment_method_configs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
