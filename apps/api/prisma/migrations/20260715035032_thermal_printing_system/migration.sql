-- CreateEnum
CREATE TYPE "PrintConnectionType" AS ENUM ('NETWORK_TCP', 'WINDOWS_PRINTER', 'FILE_OR_VIRTUAL');

-- CreateEnum
CREATE TYPE "PrintFallbackPolicy" AS ENUM ('DEFAULT_STATION', 'BLOCK');

-- CreateEnum
CREATE TYPE "PrintRoutingScope" AS ENUM ('PRODUCT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('ORDER_INITIAL', 'ORDER_ADDITION', 'ORDER_REMOVAL', 'ORDER_CORRECTION', 'ORDER_CANCELLATION', 'CASHIER_RECEIPT', 'DISPATCH_ORDER', 'CUSTOMER_RECEIPT', 'TEST_PAGE', 'REPRINT');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'PRINTING', 'PRINTED', 'RETRY_WAIT', 'FAILED', 'CANCELLED', 'PRINT_RESULT_UNKNOWN');

-- CreateEnum
CREATE TYPE "PrintAttemptStatus" AS ENUM ('CLAIMED', 'PRINTING', 'PRINTED', 'RETRY_SCHEDULED', 'FAILED', 'RESULT_UNKNOWN');

-- CreateTable
CREATE TABLE "printing_settings" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "fallback_policy" "PrintFallbackPolicy" NOT NULL DEFAULT 'DEFAULT_STATION',
    "fallback_station_id" TEXT,
    "print_order_ready" BOOLEAN NOT NULL DEFAULT true,
    "print_payment_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "print_cancellation" BOOLEAN NOT NULL DEFAULT true,
    "customer_receipt_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_max_attempts" INTEGER NOT NULL DEFAULT 5,
    "lease_duration_seconds" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_stations" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printer_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "name" TEXT NOT NULL,
    "connection_type" "PrintConnectionType" NOT NULL,
    "address" TEXT NOT NULL,
    "port" INTEGER,
    "paper_width" INTEGER NOT NULL DEFAULT 80,
    "encoding" TEXT NOT NULL DEFAULT 'CP860',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_routing_rules" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "scope" "PrintRoutingScope" NOT NULL,
    "product_id" TEXT,
    "category_id" TEXT,
    "station_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printer_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_templates" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "station_id" TEXT,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "job_type" "PrintJobType" NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_agents" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "version" TEXT,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_agent_heartbeats" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "available_printer_ids" JSONB NOT NULL DEFAULT '[]',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_agent_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "printer_id" TEXT,
    "station_id" TEXT,
    "station_code" TEXT,
    "order_id" TEXT,
    "template_id" TEXT,
    "job_type" "PrintJobType" NOT NULL,
    "template_key" TEXT NOT NULL,
    "template_version" TEXT NOT NULL,
    "payload_snapshot" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_by_agent_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "lease_token_hash" TEXT,
    "printed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "ambiguous_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message_sanitized" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "original_job_id" TEXT,
    "reprint_reason" TEXT,
    "requested_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_job_attempts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "PrintAttemptStatus" NOT NULL DEFAULT 'CLAIMED',
    "content_hash" TEXT,
    "error_code" TEXT,
    "error_message_sanitized" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_job_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_audit_logs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "job_id" TEXT,
    "printer_id" TEXT,
    "agent_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "printing_settings_store_id_key" ON "printing_settings"("store_id");

-- CreateIndex
CREATE INDEX "printer_stations_store_id_enabled_name_idx" ON "printer_stations"("store_id", "enabled", "name");

-- CreateIndex
CREATE UNIQUE INDEX "printer_stations_store_id_code_key" ON "printer_stations"("store_id", "code");

-- CreateIndex
CREATE INDEX "printers_store_id_station_id_enabled_idx" ON "printers"("store_id", "station_id", "enabled");

-- CreateIndex
CREATE INDEX "printers_agent_id_enabled_idx" ON "printers"("agent_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "printers_store_id_name_key" ON "printers"("store_id", "name");

-- One explicit default printer is allowed per station.
CREATE UNIQUE INDEX "printers_one_default_per_station_idx"
ON "printers"("store_id", "station_id")
WHERE "is_default" = TRUE;

ALTER TABLE "printers"
ADD CONSTRAINT "printers_connection_config_check" CHECK (
  ("connection_type" = 'NETWORK_TCP' AND "port" BETWEEN 1 AND 65535)
  OR ("connection_type" <> 'NETWORK_TCP' AND "port" IS NULL)
);

ALTER TABLE "printers"
ADD CONSTRAINT "printers_paper_width_check" CHECK ("paper_width" IN (58, 80));

-- CreateIndex
CREATE INDEX "printer_routing_rules_store_id_enabled_priority_idx" ON "printer_routing_rules"("store_id", "enabled", "priority");

-- CreateIndex
CREATE INDEX "printer_routing_rules_product_id_idx" ON "printer_routing_rules"("product_id");

-- CreateIndex
CREATE INDEX "printer_routing_rules_category_id_idx" ON "printer_routing_rules"("category_id");

ALTER TABLE "printer_routing_rules"
ADD CONSTRAINT "printer_routing_rules_target_check" CHECK (
  ("scope" = 'PRODUCT' AND "product_id" IS NOT NULL AND "category_id" IS NULL)
  OR ("scope" = 'CATEGORY' AND "category_id" IS NOT NULL AND "product_id" IS NULL)
);

CREATE UNIQUE INDEX "printer_routing_rules_one_product_idx"
ON "printer_routing_rules"("store_id", "product_id")
WHERE "product_id" IS NOT NULL;

CREATE UNIQUE INDEX "printer_routing_rules_one_category_idx"
ON "printer_routing_rules"("store_id", "category_id")
WHERE "category_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "print_templates_store_id_job_type_enabled_idx" ON "print_templates"("store_id", "job_type", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "print_templates_store_id_key_version_key" ON "print_templates"("store_id", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "print_agents_token_hash_key" ON "print_agents"("token_hash");

-- CreateIndex
CREATE INDEX "print_agents_store_id_enabled_last_seen_at_idx" ON "print_agents"("store_id", "enabled", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "print_agents_store_id_name_key" ON "print_agents"("store_id", "name");

-- CreateIndex
CREATE INDEX "print_agent_heartbeats_agent_id_occurred_at_idx" ON "print_agent_heartbeats"("agent_id", "occurred_at");

-- CreateIndex
CREATE INDEX "print_agent_heartbeats_store_id_occurred_at_idx" ON "print_agent_heartbeats"("store_id", "occurred_at");

-- CreateIndex
CREATE INDEX "print_jobs_store_id_status_available_at_priority_created_at_idx" ON "print_jobs"("store_id", "status", "available_at", "priority", "created_at");

-- CreateIndex
CREATE INDEX "print_jobs_printer_id_status_available_at_idx" ON "print_jobs"("printer_id", "status", "available_at");

-- CreateIndex
CREATE INDEX "print_jobs_claimed_by_agent_id_status_lease_expires_at_idx" ON "print_jobs"("claimed_by_agent_id", "status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "print_jobs_order_id_created_at_idx" ON "print_jobs"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "print_jobs_original_job_id_idx" ON "print_jobs"("original_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_jobs_store_id_idempotency_key_key" ON "print_jobs"("store_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "print_job_attempts_agent_id_started_at_idx" ON "print_job_attempts"("agent_id", "started_at");

-- CreateIndex
CREATE INDEX "print_job_attempts_status_started_at_idx" ON "print_job_attempts"("status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "print_job_attempts_job_id_attempt_number_key" ON "print_job_attempts"("job_id", "attempt_number");

ALTER TABLE "printing_settings"
ADD CONSTRAINT "printing_settings_limits_check" CHECK (
  "default_max_attempts" BETWEEN 1 AND 20
  AND "lease_duration_seconds" BETWEEN 15 AND 300
);

ALTER TABLE "print_jobs"
ADD CONSTRAINT "print_jobs_attempts_check" CHECK (
  "attempt_count" >= 0
  AND "max_attempts" BETWEEN 1 AND 20
  AND "attempt_count" <= "max_attempts"
);

-- CreateIndex
CREATE INDEX "print_audit_logs_store_id_created_at_idx" ON "print_audit_logs"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "print_audit_logs_job_id_created_at_idx" ON "print_audit_logs"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "print_audit_logs_agent_id_created_at_idx" ON "print_audit_logs"("agent_id", "created_at");

-- AddForeignKey
ALTER TABLE "printing_settings" ADD CONSTRAINT "printing_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printing_settings" ADD CONSTRAINT "printing_settings_fallback_station_id_fkey" FOREIGN KEY ("fallback_station_id") REFERENCES "printer_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_stations" ADD CONSTRAINT "printer_stations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "printer_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "print_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_routing_rules" ADD CONSTRAINT "printer_routing_rules_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_routing_rules" ADD CONSTRAINT "printer_routing_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_routing_rules" ADD CONSTRAINT "printer_routing_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_routing_rules" ADD CONSTRAINT "printer_routing_rules_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "printer_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "printer_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_agents" ADD CONSTRAINT "print_agents_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_agent_heartbeats" ADD CONSTRAINT "print_agent_heartbeats_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_agent_heartbeats" ADD CONSTRAINT "print_agent_heartbeats_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "print_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "printer_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "print_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_claimed_by_agent_id_fkey" FOREIGN KEY ("claimed_by_agent_id") REFERENCES "print_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_original_job_id_fkey" FOREIGN KEY ("original_job_id") REFERENCES "print_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job_attempts" ADD CONSTRAINT "print_job_attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "print_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job_attempts" ADD CONSTRAINT "print_job_attempts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "print_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_audit_logs" ADD CONSTRAINT "print_audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_audit_logs" ADD CONSTRAINT "print_audit_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "print_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_audit_logs" ADD CONSTRAINT "print_audit_logs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_audit_logs" ADD CONSTRAINT "print_audit_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "print_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
