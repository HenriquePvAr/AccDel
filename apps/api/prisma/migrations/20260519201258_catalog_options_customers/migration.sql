-- AlterTable
ALTER TABLE "product_option_groups" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_options" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "delivery_assignments_store_id_driver_id_status_final_sequence_i" RENAME TO "delivery_assignments_store_id_driver_id_status_final_sequen_idx";
