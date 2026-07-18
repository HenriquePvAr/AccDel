-- Cash register v2 hardening: tenant integrity, immutable ledger and payment reconciliation.

ALTER TABLE "stores"
ADD COLUMN "cash_withdrawal_approval_threshold" DECIMAL(10,2);

ALTER TABLE "payment_audits"
ADD COLUMN "cash_register_id" TEXT;

ALTER TABLE "table_sessions"
ADD COLUMN "cash_register_id" TEXT;

ALTER TABLE "cash_movements"
ADD COLUMN "table_session_id" TEXT;

ALTER TABLE "stores"
ADD CONSTRAINT "stores_cash_withdrawal_approval_threshold_check"
CHECK (
  "cash_withdrawal_approval_threshold" IS NULL
  OR "cash_withdrawal_approval_threshold" >= 0
);

ALTER TABLE "cash_registers"
ADD CONSTRAINT "cash_registers_amounts_check"
CHECK (
  "opening_amount" >= 0
  AND "expected_amount" >= 0
  AND "counted_amount" >= 0
);

ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_amounts_check"
CHECK (
  "amount" >= 0
  AND ("balance_before" IS NULL OR "balance_before" >= 0)
  AND ("balance_after" IS NULL OR "balance_after" >= 0)
);

ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_v2_reason_check"
CHECK (
  "type" NOT IN (
    'CASH_SUPPLY'::"CashMovementType",
    'CASH_WITHDRAWAL'::"CashMovementType",
    'CASH_REFUND'::"CashMovementType",
    'CASH_ADJUSTMENT'::"CashMovementType"
  )
  OR NULLIF(BTRIM("reason"), '') IS NOT NULL
);

ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_immutable_flag_check"
CHECK ("immutable" = TRUE);

CREATE UNIQUE INDEX "cash_terminals_id_store_id_key"
ON "cash_terminals"("id", "store_id");

CREATE UNIQUE INDEX "cash_registers_id_store_id_key"
ON "cash_registers"("id", "store_id");

ALTER TABLE "cash_registers"
ADD CONSTRAINT "cash_registers_terminal_store_fkey"
FOREIGN KEY ("terminal_id", "store_id")
REFERENCES "cash_terminals"("id", "store_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_register_store_fkey"
FOREIGN KEY ("cash_register_id", "store_id")
REFERENCES "cash_registers"("id", "store_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_audits"
ADD CONSTRAINT "payment_audits_cash_register_id_fkey"
FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "table_sessions"
ADD CONSTRAINT "table_sessions_cash_register_id_fkey"
FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_table_session_id_fkey"
FOREIGN KEY ("table_session_id") REFERENCES "table_sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payment_audits_cash_register_status_method_created_idx"
ON "payment_audits"("cash_register_id", "status", "method", "created_at");

CREATE INDEX "table_sessions_cash_register_status_method_closed_idx"
ON "table_sessions"("cash_register_id", "status", "payment_method", "closed_at");

CREATE INDEX "cash_movements_table_session_id_idx"
ON "cash_movements"("table_session_id");

DROP INDEX "cash_movements_store_register_idempotency_idx";

CREATE UNIQUE INDEX "cash_movements_store_register_type_idempotency_idx"
ON "cash_movements"("store_id", "cash_register_id", "type", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

CREATE UNIQUE INDEX "cash_movements_order_type_once_idx"
ON "cash_movements"("store_id", "order_id", "type")
WHERE "order_id" IS NOT NULL
  AND "type" IN ('CASH_SALE'::"CashMovementType", 'CASH_REFUND'::"CashMovementType");

CREATE UNIQUE INDEX "cash_movements_table_session_sale_once_idx"
ON "cash_movements"("store_id", "table_session_id", "type")
WHERE "table_session_id" IS NOT NULL
  AND "type" = 'CASH_SALE'::"CashMovementType";

CREATE UNIQUE INDEX "cash_movements_payment_audit_type_once_idx"
ON "cash_movements"("payment_audit_id", "type")
WHERE "payment_audit_id" IS NOT NULL;

CREATE UNIQUE INDEX "cash_movements_opening_once_idx"
ON "cash_movements"("cash_register_id")
WHERE "type" = 'OPENING_BALANCE'::"CashMovementType";

CREATE UNIQUE INDEX "cash_movements_closing_difference_once_idx"
ON "cash_movements"("cash_register_id")
WHERE "type" = 'CLOSING_DIFFERENCE'::"CashMovementType";

CREATE OR REPLACE FUNCTION prevent_cash_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.cash_allow_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'cash ledger rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cash_movements_immutable_trigger"
BEFORE UPDATE OR DELETE ON "cash_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_cash_ledger_mutation();

CREATE TRIGGER "cash_audit_logs_immutable_trigger"
BEFORE UPDATE OR DELETE ON "cash_audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_cash_ledger_mutation();
