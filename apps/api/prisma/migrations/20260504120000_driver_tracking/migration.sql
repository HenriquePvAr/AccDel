-- CreateEnum
CREATE TYPE "DriverLocationSource" AS ENUM ('gps', 'app', 'admin', 'simulator', 'fallback');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('active', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "latitude" DECIMAL(10,7) NOT NULL DEFAULT -3.1019000,
ADD COLUMN "longitude" DECIMAL(10,7) NOT NULL DEFAULT -60.0217000;

-- AlterTable
ALTER TABLE "customer_addresses" ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "delivery_latitude" DECIMAL(10,7),
ADD COLUMN "delivery_longitude" DECIMAL(10,7);

-- CreateTable
CREATE TABLE "driver_locations" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "driver_profile_id" TEXT NOT NULL,
    "order_id" TEXT,
    "assignment_id" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speed_kmh" DECIMAL(6,2),
    "heading" DECIMAL(6,2),
    "accuracy_meters" DECIMAL(8,2),
    "source" "DriverLocationSource" NOT NULL DEFAULT 'gps',
    "captured_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "store_user_id" TEXT NOT NULL,
    "planned_sequence" INTEGER NOT NULL DEFAULT 1,
    "final_sequence" INTEGER NOT NULL DEFAULT 1,
    "actual_sequence" INTEGER,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'active',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eta_snapshots" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "provider" TEXT NOT NULL,
    "eta_minutes" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "from_latitude" DECIMAL(10,7),
    "from_longitude" DECIMAL(10,7),
    "to_latitude" DECIMAL(10,7),
    "to_longitude" DECIMAL(10,7),
    "route_geometry" JSONB,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eta_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_locations_store_id_is_active_captured_at_idx" ON "driver_locations"("store_id", "is_active", "captured_at");

-- CreateIndex
CREATE INDEX "driver_locations_driver_id_is_active_captured_at_idx" ON "driver_locations"("driver_id", "is_active", "captured_at");

-- CreateIndex
CREATE INDEX "driver_locations_driver_profile_id_captured_at_idx" ON "driver_locations"("driver_profile_id", "captured_at");

-- CreateIndex
CREATE INDEX "driver_locations_order_id_captured_at_idx" ON "driver_locations"("order_id", "captured_at");

-- CreateIndex
CREATE INDEX "driver_locations_assignment_id_captured_at_idx" ON "driver_locations"("assignment_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_assignments_order_id_status_key" ON "delivery_assignments"("order_id", "status");

-- CreateIndex
CREATE INDEX "delivery_assignments_store_id_driver_id_status_final_sequence_idx" ON "delivery_assignments"("store_id", "driver_id", "status", "final_sequence");

-- CreateIndex
CREATE INDEX "delivery_assignments_driver_id_status_assigned_at_idx" ON "delivery_assignments"("driver_id", "status", "assigned_at");

-- CreateIndex
CREATE INDEX "eta_snapshots_store_id_order_id_created_at_idx" ON "eta_snapshots"("store_id", "order_id", "created_at");

-- CreateIndex
CREATE INDEX "eta_snapshots_driver_id_created_at_idx" ON "eta_snapshots"("driver_id", "created_at");

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_profile_id_fkey" FOREIGN KEY ("driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "delivery_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_store_user_id_fkey" FOREIGN KEY ("store_user_id") REFERENCES "store_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eta_snapshots" ADD CONSTRAINT "eta_snapshots_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eta_snapshots" ADD CONSTRAINT "eta_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eta_snapshots" ADD CONSTRAINT "eta_snapshots_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
