-- AlterTable
ALTER TABLE "waiter_profiles" ADD COLUMN     "cancellations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tables_served" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_orders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_sales" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "waiter_history_entries" (
    "id" TEXT NOT NULL,
    "waiter_profile_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waiter_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waiter_history_entries_waiter_profile_id_created_at_idx" ON "waiter_history_entries"("waiter_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "waiter_history_entries" ADD CONSTRAINT "waiter_history_entries_waiter_profile_id_fkey" FOREIGN KEY ("waiter_profile_id") REFERENCES "waiter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
