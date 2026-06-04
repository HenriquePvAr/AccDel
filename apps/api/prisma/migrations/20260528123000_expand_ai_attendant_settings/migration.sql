-- Expand AI attendant behavior settings and knowledge categories.

CREATE TYPE "AiResponseLength" AS ENUM ('short', 'medium', 'detailed');

ALTER TYPE "AiKnowledgeEntryType" ADD VALUE IF NOT EXISTS 'promotions';

ALTER TABLE "ai_attendant_settings"
  ADD COLUMN "assistant_name" TEXT NOT NULL DEFAULT 'Atendente Cain',
  ADD COLUMN "main_prompt" TEXT NOT NULL DEFAULT 'Voce e um atendente virtual de delivery. Responda de forma educada, clara e humanizada. Use apenas informacoes oficiais da loja, cardapio e base de conhecimento. Se nao souber, chame um atendente humano.',
  ADD COLUMN "response_length" "AiResponseLength" NOT NULL DEFAULT 'medium',
  ADD COLUMN "never_invent_price" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "never_invent_product" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "never_invent_promotion" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "never_promise_delivery_time" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "transfer_on_human_request" BOOLEAN NOT NULL DEFAULT true;
