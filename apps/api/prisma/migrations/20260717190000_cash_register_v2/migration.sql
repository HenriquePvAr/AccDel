-- Cash register v2: additive, auditable, terminal-aware cash sessions.

ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CASH_SALE';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CASH_SUPPLY';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CASH_WITHDRAWAL';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CASH_REFUND';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CASH_ADJUSTMENT';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CLOSING_DIFFERENCE';

CREATE TABLE "cash_terminals" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_terminals_pkey" PRIMARY KEY ("id")
);

INSERT INTO "cash_terminals" ("id", "store_id", "code", "name", "description", "active", "created_at", "updated_at")
SELECT
    'legacy_terminal_' || "id",
    "id",
    'main',
    'Caixa principal',
    'Terminal padrao criado para compatibilidade com caixas existentes.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "stores"
ON CONFLICT DO NOTHING;

ALTER TABLE "cash_registers" ADD COLUMN "terminal_id" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "opened_by_user_id" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "opened_by_name" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "closed_by_user_id" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "closed_by_name" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "opening_note" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "closing_note" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "difference_reason" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "idempotency_key" TEXT;

UPDATE "cash_registers"
SET "terminal_id" = 'legacy_terminal_' || "store_id"
WHERE "terminal_id" IS NULL;

UPDATE "cash_registers"
SET "opened_by_name" = "operator_name"
WHERE "opened_by_name" IS NULL;

ALTER TABLE "cash_movements" ADD COLUMN "store_id" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "reason" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "operator_user_id" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "operator_name" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "approved_by_user_id" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "approved_by_name" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "balance_before" DECIMAL(10,2);
ALTER TABLE "cash_movements" ADD COLUMN "balance_after" DECIMAL(10,2);
ALTER TABLE "cash_movements" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "order_id" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "payment_audit_id" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "original_movement_id" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "immutable" BOOLEAN NOT NULL DEFAULT true;

UPDATE "cash_movements" movement
SET
    "store_id" = register."store_id",
    "operator_name" = movement."user_name"
FROM "cash_registers" register
WHERE movement."cash_register_id" = register."id";

ALTER TABLE "cash_movements" ALTER COLUMN "store_id" SET NOT NULL;

CREATE TABLE "cash_audit_logs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "cash_register_id" TEXT,
    "cash_movement_id" TEXT,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_by_name" TEXT,
    "idempotency_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_terminals_store_id_code_key" ON "cash_terminals"("store_id", "code");
CREATE INDEX "cash_terminals_store_id_active_name_idx" ON "cash_terminals"("store_id", "active", "name");

CREATE UNIQUE INDEX "cash_registers_one_open_per_terminal_idx"
ON "cash_registers"("terminal_id")
WHERE "status" = 'open' AND "terminal_id" IS NOT NULL;

CREATE UNIQUE INDEX "cash_registers_store_id_idempotency_key_idx"
ON "cash_registers"("store_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX "cash_registers_terminal_id_status_opened_at_idx" ON "cash_registers"("terminal_id", "status", "opened_at");
CREATE INDEX "cash_registers_opened_by_user_id_opened_at_idx" ON "cash_registers"("opened_by_user_id", "opened_at");
CREATE INDEX "cash_registers_closed_by_user_id_closed_at_idx" ON "cash_registers"("closed_by_user_id", "closed_at");

CREATE UNIQUE INDEX "cash_movements_store_register_idempotency_idx"
ON "cash_movements"("store_id", "cash_register_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX "cash_movements_store_id_type_created_at_idx" ON "cash_movements"("store_id", "type", "created_at");
CREATE INDEX "cash_movements_operator_user_id_created_at_idx" ON "cash_movements"("operator_user_id", "created_at");
CREATE INDEX "cash_movements_order_id_idx" ON "cash_movements"("order_id");
CREATE INDEX "cash_movements_payment_audit_id_idx" ON "cash_movements"("payment_audit_id");
CREATE INDEX "cash_movements_original_movement_id_idx" ON "cash_movements"("original_movement_id");

CREATE INDEX "cash_audit_logs_store_id_action_created_at_idx" ON "cash_audit_logs"("store_id", "action", "created_at");
CREATE INDEX "cash_audit_logs_cash_register_id_created_at_idx" ON "cash_audit_logs"("cash_register_id", "created_at");
CREATE INDEX "cash_audit_logs_cash_movement_id_idx" ON "cash_audit_logs"("cash_movement_id");
CREATE INDEX "cash_audit_logs_actor_user_id_created_at_idx" ON "cash_audit_logs"("actor_user_id", "created_at");

ALTER TABLE "cash_terminals" ADD CONSTRAINT "cash_terminals_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_terminal_id_fkey"
FOREIGN KEY ("terminal_id") REFERENCES "cash_terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_opened_by_user_id_fkey"
FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_closed_by_user_id_fkey"
FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_operator_user_id_fkey"
FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_payment_audit_id_fkey"
FOREIGN KEY ("payment_audit_id") REFERENCES "payment_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_original_movement_id_fkey"
FOREIGN KEY ("original_movement_id") REFERENCES "cash_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_audit_logs" ADD CONSTRAINT "cash_audit_logs_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_audit_logs" ADD CONSTRAINT "cash_audit_logs_cash_register_id_fkey"
FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_audit_logs" ADD CONSTRAINT "cash_audit_logs_cash_movement_id_fkey"
FOREIGN KEY ("cash_movement_id") REFERENCES "cash_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_audit_logs" ADD CONSTRAINT "cash_audit_logs_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_audit_logs" ADD CONSTRAINT "cash_audit_logs_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
