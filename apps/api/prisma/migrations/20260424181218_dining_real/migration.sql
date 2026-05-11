-- CreateEnum
CREATE TYPE "DiningTableStatus" AS ENUM ('free', 'occupied', 'reserved', 'closing', 'closed');

-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('open', 'awaiting_close', 'closed');

-- CreateEnum
CREATE TYPE "TableSessionEventType" AS ENUM ('opened', 'item_added', 'waiter_assigned', 'awaiting_close', 'reopened', 'closed', 'transferred', 'split', 'updated');

-- CreateTable
CREATE TABLE "dining_areas" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_tables" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "waiter_id" TEXT,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "DiningTableStatus" NOT NULL DEFAULT 'free',
    "guest_count" INTEGER,
    "notes" TEXT,
    "current_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_sessions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "waiter_id" TEXT,
    "closed_by_id" TEXT,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "service_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod",
    "status" "TableSessionStatus" NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_session_items" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_session_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_session_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "TableSessionEventType" NOT NULL,
    "label" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_session_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dining_areas_store_id_sort_order_idx" ON "dining_areas"("store_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_current_session_id_key" ON "dining_tables"("current_session_id");

-- CreateIndex
CREATE INDEX "dining_tables_store_id_area_id_status_idx" ON "dining_tables"("store_id", "area_id", "status");

-- CreateIndex
CREATE INDEX "dining_tables_waiter_id_status_idx" ON "dining_tables"("waiter_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_store_id_code_key" ON "dining_tables"("store_id", "code");

-- CreateIndex
CREATE INDEX "table_sessions_store_id_status_opened_at_idx" ON "table_sessions"("store_id", "status", "opened_at");

-- CreateIndex
CREATE INDEX "table_sessions_table_id_status_idx" ON "table_sessions"("table_id", "status");

-- CreateIndex
CREATE INDEX "table_sessions_waiter_id_opened_at_idx" ON "table_sessions"("waiter_id", "opened_at");

-- CreateIndex
CREATE INDEX "table_session_items_session_id_created_at_idx" ON "table_session_items"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "table_session_items_product_id_idx" ON "table_session_items"("product_id");

-- CreateIndex
CREATE INDEX "table_session_events_session_id_created_at_idx" ON "table_session_events"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "dining_areas" ADD CONSTRAINT "dining_areas_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "dining_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_current_session_id_fkey" FOREIGN KEY ("current_session_id") REFERENCES "table_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session_items" ADD CONSTRAINT "table_session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session_items" ADD CONSTRAINT "table_session_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session_events" ADD CONSTRAINT "table_session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
