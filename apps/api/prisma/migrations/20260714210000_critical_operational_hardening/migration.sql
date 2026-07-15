-- Extend payment lifecycle without removing or rewriting existing values.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'cancelled';

-- Persist idempotent results for critical operations.
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "response_data" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- Record inbound provider events before business rules run.
CREATE TABLE "webhook_receipts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- Keep an immutable audit trail for payment state changes.
CREATE TABLE "payment_audits" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "source" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "external_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_store_id_actor_id_operation_key_key"
ON "idempotency_records"("store_id", "actor_id", "operation", "key");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
CREATE UNIQUE INDEX "webhook_receipts_provider_session_id_event_id_key"
ON "webhook_receipts"("provider", "session_id", "event_id");
CREATE INDEX "webhook_receipts_store_id_received_at_idx" ON "webhook_receipts"("store_id", "received_at");
CREATE INDEX "webhook_receipts_expires_at_idx" ON "webhook_receipts"("expires_at");
CREATE INDEX "payment_audits_store_id_order_id_created_at_idx"
ON "payment_audits"("store_id", "order_id", "created_at");
CREATE INDEX "payment_audits_external_reference_idx" ON "payment_audits"("external_reference");

ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_receipts" ADD CONSTRAINT "webhook_receipts_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_receipts" ADD CONSTRAINT "webhook_receipts_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_audits" ADD CONSTRAINT "payment_audits_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_audits" ADD CONSTRAINT "payment_audits_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
