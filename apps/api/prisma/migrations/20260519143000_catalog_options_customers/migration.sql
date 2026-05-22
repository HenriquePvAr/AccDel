ALTER TABLE "customers" ADD COLUMN "notes" TEXT;

CREATE TABLE "product_option_groups" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_options" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_option_group_links" (
  "product_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "min_selections" INTEGER NOT NULL DEFAULT 0,
  "max_selections" INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,

  CONSTRAINT "product_option_group_links_pkey" PRIMARY KEY ("product_id","group_id")
);

ALTER TABLE "table_session_items" ADD COLUMN "options" JSONB NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX "product_option_groups_store_id_name_key"
  ON "product_option_groups"("store_id", "name");

CREATE INDEX "product_option_groups_store_id_sort_order_idx"
  ON "product_option_groups"("store_id", "sort_order");

CREATE UNIQUE INDEX "product_options_group_id_name_key"
  ON "product_options"("group_id", "name");

CREATE INDEX "product_options_group_id_sort_order_idx"
  ON "product_options"("group_id", "sort_order");

CREATE INDEX "product_option_group_links_group_id_idx"
  ON "product_option_group_links"("group_id");

ALTER TABLE "product_option_groups"
  ADD CONSTRAINT "product_option_groups_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_options"
  ADD CONSTRAINT "product_options_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_option_group_links"
  ADD CONSTRAINT "product_option_group_links_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_option_group_links"
  ADD CONSTRAINT "product_option_group_links_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
