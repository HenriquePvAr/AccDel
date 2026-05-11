-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('owner', 'manager', 'attendant', 'cashier', 'kitchen', 'waiter', 'driver', 'supervisor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DriverAvailabilityStatus" AS ENUM ('available', 'delivering', 'paused');

-- CreateEnum
CREATE TYPE "WaiterOperationalStatus" AS ENUM ('available', 'serving', 'paused');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "estimated_delivery_time_minutes" INTEGER,
ADD COLUMN     "estimated_prep_time_minutes" INTEGER,
ADD COLUMN     "estimated_total_time_minutes" INTEGER;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "estimated_counter_time_minutes" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "estimated_delivery_time_minutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "estimated_dine_in_time_minutes" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "estimated_pickup_time_minutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "estimated_prep_time_minutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_users" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "store_user_id" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "availability" "DriverAvailabilityStatus" NOT NULL DEFAULT 'available',
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiter_profiles" (
    "id" TEXT NOT NULL,
    "store_user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" "WaiterOperationalStatus" NOT NULL DEFAULT 'available',
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waiter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "store_users_store_id_role_active_idx" ON "store_users"("store_id", "role", "active");

-- CreateIndex
CREATE INDEX "store_users_user_id_active_idx" ON "store_users"("user_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "store_users_store_id_user_id_key" ON "store_users"("store_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_store_user_id_key" ON "driver_profiles"("store_user_id");

-- CreateIndex
CREATE INDEX "driver_profiles_active_availability_idx" ON "driver_profiles"("active", "availability");

-- CreateIndex
CREATE UNIQUE INDEX "waiter_profiles_store_user_id_key" ON "waiter_profiles"("store_user_id");

-- CreateIndex
CREATE INDEX "waiter_profiles_active_status_idx" ON "waiter_profiles"("active", "status");

-- CreateIndex
CREATE INDEX "orders_driver_id_status_idx" ON "orders"("driver_id", "status");

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_store_user_id_fkey" FOREIGN KEY ("store_user_id") REFERENCES "store_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_profiles" ADD CONSTRAINT "waiter_profiles_store_user_id_fkey" FOREIGN KEY ("store_user_id") REFERENCES "store_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
