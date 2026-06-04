-- Extend product options so the catalog can represent global availability for
-- flavors/add-ons and reuse option groups through category-level defaults.

ALTER TABLE "product_options"
  ADD COLUMN "image" TEXT,
  ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sold_out" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "product_option_group_links"
  ADD COLUMN "auto_applied" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "product_option_group_category_links" (
  "category_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "min_selections" INTEGER NOT NULL DEFAULT 0,
  "max_selections" INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "auto_apply" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_option_group_category_links_pkey" PRIMARY KEY ("category_id","group_id")
);

CREATE INDEX "product_option_group_category_links_group_id_idx"
  ON "product_option_group_category_links"("group_id");

ALTER TABLE "product_option_group_category_links"
  ADD CONSTRAINT "product_option_group_category_links_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_option_group_category_links"
  ADD CONSTRAINT "product_option_group_category_links_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "product_option_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "product_option_group_category_links" (
  "category_id",
  "group_id",
  "required",
  "min_selections",
  "max_selections",
  "sort_order",
  "description",
  "auto_apply",
  "created_at",
  "updated_at"
)
SELECT
  "products"."category_id",
  "product_option_group_links"."group_id",
  bool_or("product_option_group_links"."required"),
  min("product_option_group_links"."min_selections"),
  max("product_option_group_links"."max_selections"),
  min("product_option_group_links"."sort_order"),
  min("product_option_group_links"."description"),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "product_option_group_links"
INNER JOIN "products"
  ON "products"."id" = "product_option_group_links"."product_id"
GROUP BY
  "products"."category_id",
  "product_option_group_links"."group_id"
ON CONFLICT ("category_id", "group_id") DO NOTHING;
