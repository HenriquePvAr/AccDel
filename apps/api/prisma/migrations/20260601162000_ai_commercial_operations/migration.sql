-- Campos comerciais e metricas operacionais do Atendente IA.
ALTER TABLE "ai_conversations"
ADD COLUMN "assigned_at" TIMESTAMP(3);

ALTER TABLE "ai_attendant_settings"
ADD COLUMN "upsell_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "upsell_max_suggestions" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "ai_order_drafts"
ADD COLUMN "metadata" JSONB,
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "converted_order_id" TEXT;
