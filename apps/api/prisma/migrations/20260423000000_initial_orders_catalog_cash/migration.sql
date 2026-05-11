CREATE TYPE "OrderStatus" AS ENUM ('in_analysis', 'in_preparation', 'ready', 'out_for_delivery', 'completed', 'cancelled');
CREATE TYPE "OrderChannel" AS ENUM ('delivery', 'dine_in', 'counter', 'pickup', 'digital_menu', 'whatsapp');
CREATE TYPE "PaymentMethod" AS ENUM ('pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'payment_link');
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'pending', 'refunded');
CREATE TYPE "PriorityLevel" AS ENUM ('normal', 'priority', 'vip');
CREATE TYPE "ProductChannel" AS ENUM ('dine_in', 'delivery', 'digital_menu', 'counter');
CREATE TYPE "CashRegisterStatus" AS ENUM ('open', 'closing', 'closed');
CREATE TYPE "CashMovementType" AS ENUM ('sale', 'withdrawal', 'supply', 'adjustment', 'refund');

CREATE TABLE "stores" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trade_name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Manaus',
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "brand_accent" TEXT NOT NULL,
  "auto_accept_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_addresses" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "complement" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "image" TEXT NOT NULL,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "preparation_station" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_channels" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "channel" "ProductChannel" NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sold_out" BOOLEAN NOT NULL DEFAULT false,
  "price_override" DECIMAL(10,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "customer_id" TEXT,
  "customer_name" TEXT NOT NULL,
  "customer_phone" TEXT NOT NULL,
  "source" "OrderChannel" NOT NULL,
  "service_type" "OrderChannel" NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "payment_method" "PaymentMethod" NOT NULL,
  "payment_status" "PaymentStatus" NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "due_at" TIMESTAMP(3) NOT NULL,
  "priority" "PriorityLevel" NOT NULL DEFAULT 'normal',
  "delayed" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "address_label" TEXT,
  "address_text" TEXT,
  "table_code" TEXT,
  "notes" TEXT,
  "driver_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "product_id" TEXT,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "notes" TEXT,
  "options" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "label" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_registers" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "status" "CashRegisterStatus" NOT NULL DEFAULT 'open',
  "operator_name" TEXT NOT NULL,
  "opening_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "expected_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "counted_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "difference_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_movements" (
  "id" TEXT NOT NULL,
  "cash_register_id" TEXT NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "method" "PaymentMethod",
  "amount" DECIMAL(10,2) NOT NULL,
  "label" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_channels_product_id_channel_key" ON "product_channels"("product_id", "channel");
CREATE UNIQUE INDEX "orders_store_id_number_key" ON "orders"("store_id", "number");
CREATE INDEX "customers_store_id_phone_idx" ON "customers"("store_id", "phone");
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");
CREATE INDEX "categories_store_id_sort_order_idx" ON "categories"("store_id", "sort_order");
CREATE INDEX "products_store_id_active_idx" ON "products"("store_id", "active");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "product_channels_channel_available_visible_idx" ON "product_channels"("channel", "available", "visible");
CREATE INDEX "orders_store_id_status_created_at_idx" ON "orders"("store_id", "status", "created_at");
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");
CREATE INDEX "orders_payment_method_idx" ON "orders"("payment_method");
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");
CREATE INDEX "cash_registers_store_id_status_opened_at_idx" ON "cash_registers"("store_id", "status", "opened_at");
CREATE INDEX "cash_movements_cash_register_id_created_at_idx" ON "cash_movements"("cash_register_id", "created_at");
CREATE INDEX "cash_movements_type_method_idx" ON "cash_movements"("type", "method");

ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_channels" ADD CONSTRAINT "product_channels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
