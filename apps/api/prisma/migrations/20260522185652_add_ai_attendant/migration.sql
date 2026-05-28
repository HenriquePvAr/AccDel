-- CreateEnum
CREATE TYPE "WhatsappSessionStatus" AS ENUM ('disconnected', 'waiting_qr', 'connecting', 'connected', 'expired', 'error');

-- CreateEnum
CREATE TYPE "WhatsappMessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "WhatsappMessageSenderType" AS ENUM ('customer', 'ai', 'human', 'system');

-- CreateEnum
CREATE TYPE "WhatsappMessageStatus" AS ENUM ('received', 'queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('open', 'waiting_ai', 'waiting_human', 'human_assigned', 'closed');

-- CreateEnum
CREATE TYPE "AiAttendantMode" AS ENUM ('off', 'suggestion', 'automatic', 'hybrid');

-- CreateEnum
CREATE TYPE "AiAttendantTone" AS ENUM ('professional', 'friendly', 'casual', 'premium');

-- CreateEnum
CREATE TYPE "AiKnowledgeEntryType" AS ENUM ('store_info', 'faq', 'policy', 'delivery_area', 'payment', 'custom');

-- CreateEnum
CREATE TYPE "AiOrderDraftStatus" AS ENUM ('suggested', 'approved', 'discarded');

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "session_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "display_name" TEXT,
    "status" "WhatsappSessionStatus" NOT NULL DEFAULT 'disconnected',
    "qr_code" TEXT,
    "qr_code_expires_at" TIMESTAMP(3),
    "last_connected_at" TIMESTAMP(3),
    "last_disconnected_at" TIMESTAMP(3),
    "last_error" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "external_message_id" TEXT,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "direction" "WhatsappMessageDirection" NOT NULL,
    "senderType" "WhatsappMessageSenderType" NOT NULL,
    "body" TEXT NOT NULL,
    "raw_payload" JSONB,
    "status" "WhatsappMessageStatus" NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "whatsapp_session_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "whatsapp_number" TEXT NOT NULL,
    "customer_name" TEXT,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'open',
    "assigned_user_id" TEXT,
    "last_message_at" TIMESTAMP(3),
    "last_ai_response_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "WhatsappMessageDirection" NOT NULL,
    "senderType" "WhatsappMessageSenderType" NOT NULL,
    "body" TEXT NOT NULL,
    "raw_payload" JSONB,
    "status" "WhatsappMessageStatus" NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge_entries" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "type" "AiKnowledgeEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key_encrypted" TEXT,
    "model_name" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_attendant_settings" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "AiAttendantMode" NOT NULL DEFAULT 'off',
    "min_delay_seconds" INTEGER NOT NULL DEFAULT 8,
    "max_delay_seconds" INTEGER NOT NULL DEFAULT 25,
    "message_grouping_seconds" INTEGER NOT NULL DEFAULT 6,
    "answer_only_during_business_hours" BOOLEAN NOT NULL DEFAULT true,
    "transfer_on_low_confidence" BOOLEAN NOT NULL DEFAULT true,
    "transfer_on_complaint" BOOLEAN NOT NULL DEFAULT true,
    "transfer_on_cancellation" BOOLEAN NOT NULL DEFAULT true,
    "tone" "AiAttendantTone" NOT NULL DEFAULT 'friendly',
    "use_emojis" BOOLEAN NOT NULL DEFAULT true,
    "call_customer_by_name" BOOLEAN NOT NULL DEFAULT true,
    "greeting_message" TEXT,
    "out_of_hours_message" TEXT,
    "human_handoff_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_attendant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_order_drafts" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "raw_text" TEXT NOT NULL,
    "parsed_items" JSONB NOT NULL DEFAULT '[]',
    "missing_fields" JSONB NOT NULL DEFAULT '[]',
    "status" "AiOrderDraftStatus" NOT NULL DEFAULT 'suggested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_order_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_sessions_store_id_status_idx" ON "whatsapp_sessions"("store_id", "status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_store_id_created_at_idx" ON "whatsapp_messages"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_session_id_created_at_idx" ON "whatsapp_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversation_id_created_at_idx" ON "whatsapp_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_from_number_created_at_idx" ON "whatsapp_messages"("from_number", "created_at");

-- CreateIndex
CREATE INDEX "ai_conversations_store_id_status_last_message_at_idx" ON "ai_conversations"("store_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "ai_conversations_whatsapp_session_id_whatsapp_number_idx" ON "ai_conversations"("whatsapp_session_id", "whatsapp_number");

-- CreateIndex
CREATE INDEX "ai_conversations_customer_id_idx" ON "ai_conversations"("customer_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_knowledge_entries_store_id_type_is_active_idx" ON "ai_knowledge_entries"("store_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_configs_store_id_provider_key" ON "ai_provider_configs"("store_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ai_attendant_settings_store_id_key" ON "ai_attendant_settings"("store_id");

-- CreateIndex
CREATE INDEX "ai_order_drafts_conversation_id_status_idx" ON "ai_order_drafts"("conversation_id", "status");

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_whatsapp_session_id_fkey" FOREIGN KEY ("whatsapp_session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge_entries" ADD CONSTRAINT "ai_knowledge_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_attendant_settings" ADD CONSTRAINT "ai_attendant_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_order_drafts" ADD CONSTRAINT "ai_order_drafts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
