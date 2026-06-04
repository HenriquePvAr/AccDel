-- Operational WhatsApp inbox, safe testing, and integration logs.

CREATE TYPE "AiConversationType" AS ENUM ('real', 'test');

CREATE TYPE "WhatsappIntegrationLogType" AS ENUM (
  'provider_status',
  'session_started',
  'session_disconnected',
  'session_restarted',
  'qr_requested',
  'webhook_received',
  'message_received',
  'message_sent',
  'message_failed',
  'ai_reply_generated',
  'ai_reply_failed',
  'delay_scheduled',
  'delay_cancelled',
  'human_assigned',
  'human_released',
  'conversation_closed',
  'test_chat',
  'test_whatsapp_sent'
);

CREATE TYPE "IntegrationLogStatus" AS ENUM ('info', 'success', 'warning', 'error');

ALTER TABLE "ai_conversations"
  ADD COLUMN "type" "AiConversationType" NOT NULL DEFAULT 'real',
  ADD COLUMN "unread_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "is_ai_paused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_status" TEXT,
  ADD COLUMN "last_error" TEXT;

ALTER TABLE "ai_messages"
  ADD COLUMN "scheduled_send_at" TIMESTAMP(3),
  ADD COLUMN "sent_at" TIMESTAMP(3),
  ADD COLUMN "failed_at" TIMESTAMP(3),
  ADD COLUMN "error_message" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "whatsapp_messages"
  ADD COLUMN "scheduled_send_at" TIMESTAMP(3),
  ADD COLUMN "sent_at" TIMESTAMP(3),
  ADD COLUMN "failed_at" TIMESTAMP(3),
  ADD COLUMN "error_message" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "ai_attendant_settings"
  ADD COLUMN "allow_test_whatsapp_send" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "default_test_whatsapp_number" TEXT;

CREATE TABLE "whatsapp_integration_logs" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "session_id" TEXT,
  "type" "WhatsappIntegrationLogType" NOT NULL,
  "status" "IntegrationLogStatus" NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_integration_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_integration_logs_store_id_created_at_idx"
  ON "whatsapp_integration_logs"("store_id", "created_at");

CREATE INDEX "whatsapp_integration_logs_session_id_created_at_idx"
  ON "whatsapp_integration_logs"("session_id", "created_at");

CREATE INDEX "whatsapp_integration_logs_type_status_idx"
  ON "whatsapp_integration_logs"("type", "status");

ALTER TABLE "whatsapp_integration_logs"
  ADD CONSTRAINT "whatsapp_integration_logs_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_integration_logs"
  ADD CONSTRAINT "whatsapp_integration_logs_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
