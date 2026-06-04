ALTER TABLE "stores"
  ADD COLUMN "default_delivery_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE TABLE "delivery_zones" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "neighborhood" TEXT NOT NULL,
  "fee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "estimated_delivery_time_minutes" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_zones_store_id_neighborhood_key"
  ON "delivery_zones"("store_id", "neighborhood");

CREATE INDEX "delivery_zones_store_id_active_sort_order_idx"
  ON "delivery_zones"("store_id", "active", "sort_order");

ALTER TABLE "delivery_zones"
  ADD CONSTRAINT "delivery_zones_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
