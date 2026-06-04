-- Strengthen store settings, AI knowledge routing and order draft conversion state.

ALTER TYPE "AiKnowledgeEntryType" ADD VALUE IF NOT EXISTS 'cancellation';
ALTER TYPE "AiOrderDraftStatus" ADD VALUE IF NOT EXISTS 'converted';

ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "public_whatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "address_line" TEXT,
  ADD COLUMN IF NOT EXISTS "neighborhood" TEXT,
  ADD COLUMN IF NOT EXISTS "business_hours" TEXT,
  ADD COLUMN IF NOT EXISTS "business_days" TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']::TEXT[],
  ADD COLUMN IF NOT EXISTS "greeting_message" TEXT,
  ADD COLUMN IF NOT EXISTS "out_of_hours_message" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellation_policy" TEXT,
  ADD COLUMN IF NOT EXISTS "general_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "minimum_order_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "delivery_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "counter_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "dine_in_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "digital_menu_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "whatsapp_ai_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ai_knowledge_entries"
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT ARRAY['whatsapp']::TEXT[];

CREATE INDEX IF NOT EXISTS "ai_knowledge_entries_store_id_is_active_priority_idx"
  ON "ai_knowledge_entries"("store_id", "is_active", "priority");

