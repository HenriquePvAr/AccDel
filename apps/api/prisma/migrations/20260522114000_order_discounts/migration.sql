ALTER TABLE "orders"
  ADD COLUMN "coupon_code" TEXT,
  ADD COLUMN "promotion_name" TEXT,
  ADD COLUMN "discount_breakdown" JSONB;
