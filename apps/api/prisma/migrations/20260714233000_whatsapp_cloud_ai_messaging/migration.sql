-- Add provider-neutral messaging, AI audit, notification and public tracking primitives.
CREATE TYPE "MessagingProviderKind" AS ENUM ('whatsapp_cloud', 'evolution_legacy');
CREATE TYPE "ConversationOperationalStatus" AS ENUM ('AI_ACTIVE', 'WAITING_HUMAN', 'HUMAN_ACTIVE', 'PAUSED', 'CLOSED');
CREATE TYPE "MessagingContentType" AS ENUM ('TEXT', 'INTERACTIVE', 'IMAGE', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'UNKNOWN');
CREATE TYPE "OutboundMessageStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "InboundEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "AiExecutionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'FALLBACK');
CREATE TYPE "AiToolCallStatus" AS ENUM ('REQUESTED', 'SUCCEEDED', 'REJECTED', 'FAILED');
CREATE TYPE "OrderNotificationType" AS ENUM ('ORDER_CONFIRMED', 'ORDER_PREPARING', 'ORDER_OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'ORDER_CANCELLED');
CREATE TYPE "OrderNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'QUEUED', 'SKIPPED', 'FAILED');

ALTER TYPE "WhatsappMessageStatus" ADD VALUE IF NOT EXISTS 'sending';
ALTER TYPE "WhatsappMessageStatus" ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE "WhatsappMessageStatus" ADD VALUE IF NOT EXISTS 'read';
ALTER TYPE "AiConversationStatus" ADD VALUE IF NOT EXISTS 'ai_active';
ALTER TYPE "AiConversationStatus" ADD VALUE IF NOT EXISTS 'human_active';
ALTER TYPE "AiConversationStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "WhatsappIntegrationLogType" ADD VALUE IF NOT EXISTS 'duplicate_ignored';
ALTER TYPE "WhatsappIntegrationLogType" ADD VALUE IF NOT EXISTS 'outbox_enqueued';
ALTER TYPE "WhatsappIntegrationLogType" ADD VALUE IF NOT EXISTS 'outbox_retry';
ALTER TYPE "WhatsappIntegrationLogType" ADD VALUE IF NOT EXISTS 'notification_queued';
ALTER TYPE "WhatsappIntegrationLogType" ADD VALUE IF NOT EXISTS 'tracking_created';
ALTER TYPE "WhatsappIntegrationLogType" ADD VALUE IF NOT EXISTS 'ai_tool_called';

CREATE TABLE "messaging_accounts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "provider" "MessagingProviderKind" NOT NULL,
    "external_account_id" TEXT,
    "phone_number_id" TEXT,
    "display_phone_number" TEXT,
    "legacy_session_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "messaging_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_channel_identities" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "provider_user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "last_inbound_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_channel_identities_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_conversations"
    ADD COLUMN "messaging_account_id" TEXT,
    ADD COLUMN "channel_identity_id" TEXT,
    ADD COLUMN "operational_status" "ConversationOperationalStatus" NOT NULL DEFAULT 'AI_ACTIVE',
    ADD COLUMN "last_inbound_at" TIMESTAMP(3),
    ADD COLUMN "prompt_version" TEXT;

ALTER TABLE "ai_order_drafts"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "confirmed_at" TIMESTAMP(3),
    ADD COLUMN "confirmation_message_id" TEXT;

CREATE TABLE "order_notifications" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "account_id" TEXT,
    "conversation_id" TEXT,
    "type" "OrderNotificationType" NOT NULL,
    "status" "OrderNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "template_name" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "order_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "order_id" TEXT,
    "notification_id" TEXT,
    "recipient" TEXT NOT NULL,
    "content_type" "MessagingContentType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboundMessageStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "external_message_id" TEXT,
    "reply_to_external_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "retention_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_events" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "external_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "normalized_payload" JSONB NOT NULL,
    "status" "InboundEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "correlation_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "retention_until" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_executions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "inbound_event_id" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "status" "AiExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "correlation_id" TEXT NOT NULL,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_tool_calls" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arguments_hash" TEXT NOT NULL,
    "status" "AiToolCallStatus" NOT NULL DEFAULT 'REQUESTED',
    "result_code" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "ai_tool_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_tracking_tokens" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_access_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_tracking_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "messaging_accounts_legacy_session_id_key" ON "messaging_accounts"("legacy_session_id");
CREATE UNIQUE INDEX "messaging_accounts_store_id_provider_key" ON "messaging_accounts"("store_id", "provider");
CREATE UNIQUE INDEX "messaging_accounts_provider_phone_number_id_key" ON "messaging_accounts"("provider", "phone_number_id");
CREATE INDEX "messaging_accounts_store_id_enabled_idx" ON "messaging_accounts"("store_id", "enabled");
CREATE UNIQUE INDEX "customer_channel_identities_account_id_provider_user_id_key" ON "customer_channel_identities"("account_id", "provider_user_id");
CREATE INDEX "customer_channel_identities_store_id_customer_id_idx" ON "customer_channel_identities"("store_id", "customer_id");
CREATE INDEX "customer_channel_identities_last_inbound_at_idx" ON "customer_channel_identities"("last_inbound_at");
CREATE UNIQUE INDEX "ai_conversations_messaging_account_id_whatsapp_number_key" ON "ai_conversations"("messaging_account_id", "whatsapp_number");
CREATE INDEX "ai_conversations_store_id_operational_status_last_message_at_idx" ON "ai_conversations"("store_id", "operational_status", "last_message_at");
CREATE INDEX "ai_conversations_channel_identity_id_idx" ON "ai_conversations"("channel_identity_id");
CREATE UNIQUE INDEX "order_notifications_order_id_type_key" ON "order_notifications"("order_id", "type");
CREATE UNIQUE INDEX "order_notifications_store_id_idempotency_key_key" ON "order_notifications"("store_id", "idempotency_key");
CREATE INDEX "order_notifications_status_created_at_idx" ON "order_notifications"("status", "created_at");
CREATE UNIQUE INDEX "outbound_messages_store_id_idempotency_key_key" ON "outbound_messages"("store_id", "idempotency_key");
CREATE UNIQUE INDEX "outbound_messages_account_id_external_message_id_key" ON "outbound_messages"("account_id", "external_message_id");
CREATE INDEX "outbound_messages_status_available_at_idx" ON "outbound_messages"("status", "available_at");
CREATE INDEX "outbound_messages_conversation_id_created_at_idx" ON "outbound_messages"("conversation_id", "created_at");
CREATE INDEX "outbound_messages_order_id_created_at_idx" ON "outbound_messages"("order_id", "created_at");
CREATE INDEX "outbound_messages_retention_until_idx" ON "outbound_messages"("retention_until");
CREATE UNIQUE INDEX "inbound_events_account_id_external_event_id_key" ON "inbound_events"("account_id", "external_event_id");
CREATE INDEX "inbound_events_status_received_at_idx" ON "inbound_events"("status", "received_at");
CREATE INDEX "inbound_events_conversation_id_received_at_idx" ON "inbound_events"("conversation_id", "received_at");
CREATE INDEX "inbound_events_retention_until_idx" ON "inbound_events"("retention_until");
CREATE UNIQUE INDEX "ai_executions_inbound_event_id_key" ON "ai_executions"("inbound_event_id");
CREATE INDEX "ai_executions_store_id_started_at_idx" ON "ai_executions"("store_id", "started_at");
CREATE INDEX "ai_executions_conversation_id_started_at_idx" ON "ai_executions"("conversation_id", "started_at");
CREATE INDEX "ai_executions_status_started_at_idx" ON "ai_executions"("status", "started_at");
CREATE INDEX "ai_tool_calls_execution_id_created_at_idx" ON "ai_tool_calls"("execution_id", "created_at");
CREATE INDEX "ai_tool_calls_name_status_created_at_idx" ON "ai_tool_calls"("name", "status", "created_at");
CREATE UNIQUE INDEX "public_tracking_tokens_token_hash_key" ON "public_tracking_tokens"("token_hash");
CREATE INDEX "public_tracking_tokens_order_id_expires_at_idx" ON "public_tracking_tokens"("order_id", "expires_at");
CREATE INDEX "public_tracking_tokens_store_id_expires_at_idx" ON "public_tracking_tokens"("store_id", "expires_at");

ALTER TABLE "messaging_accounts" ADD CONSTRAINT "messaging_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messaging_accounts" ADD CONSTRAINT "messaging_accounts_legacy_session_id_fkey" FOREIGN KEY ("legacy_session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_channel_identities" ADD CONSTRAINT "customer_channel_identities_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_channel_identities" ADD CONSTRAINT "customer_channel_identities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "messaging_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_channel_identities" ADD CONSTRAINT "customer_channel_identities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_messaging_account_id_fkey" FOREIGN KEY ("messaging_account_id") REFERENCES "messaging_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_channel_identity_id_fkey" FOREIGN KEY ("channel_identity_id") REFERENCES "customer_channel_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "messaging_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "messaging_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "order_notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "messaging_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_inbound_event_id_fkey" FOREIGN KEY ("inbound_event_id") REFERENCES "inbound_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "ai_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_tracking_tokens" ADD CONSTRAINT "public_tracking_tokens_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_tracking_tokens" ADD CONSTRAINT "public_tracking_tokens_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
