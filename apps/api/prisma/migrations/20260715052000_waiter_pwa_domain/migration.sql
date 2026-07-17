-- Add optimistic concurrency versions without changing existing records.
ALTER TABLE "dining_tables"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "table_sessions"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "order_items"
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancel_reason" TEXT;

-- Link each command line to the exact production order/item and record controlled
-- cancellation/delivery actions. Existing historical lines remain valid with NULL links.
ALTER TABLE "table_session_items"
ADD COLUMN "production_order_id" TEXT,
ADD COLUMN "production_order_item_id" TEXT,
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancelled_by_id" TEXT,
ADD COLUMN "cancel_reason" TEXT,
ADD COLUMN "delivered_at" TIMESTAMP(3),
ADD COLUMN "delivered_by_id" TEXT;

CREATE UNIQUE INDEX "table_session_items_production_order_item_id_key"
ON "table_session_items"("production_order_item_id");

CREATE INDEX "table_session_items_production_order_id_idx"
ON "table_session_items"("production_order_id");

CREATE INDEX "table_session_items_session_id_cancelled_at_delivered_at_idx"
ON "table_session_items"("session_id", "cancelled_at", "delivered_at");

ALTER TABLE "table_session_items"
ADD CONSTRAINT "table_session_items_production_order_id_fkey"
FOREIGN KEY ("production_order_id") REFERENCES "orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "table_session_items"
ADD CONSTRAINT "table_session_items_production_order_item_id_fkey"
FOREIGN KEY ("production_order_item_id") REFERENCES "order_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "table_session_items"
ADD CONSTRAINT "table_session_items_cancelled_by_id_fkey"
FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "table_session_items"
ADD CONSTRAINT "table_session_items_delivered_by_id_fkey"
FOREIGN KEY ("delivered_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
