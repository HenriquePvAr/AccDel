import { z } from 'zod'

// ── Enums (reusable) ────────────────────────────────────────────────

export const aiAttendantModeSchema = z.enum([
  'off',
  'suggestion',
  'automatic',
  'hybrid',
])

export const aiAttendantToneSchema = z.enum([
  'professional',
  'friendly',
  'casual',
  'premium',
])

export const aiResponseLengthSchema = z.enum([
  'short',
  'medium',
  'detailed',
])

export const aiKnowledgeEntryTypeSchema = z.enum([
  'store_info',
  'faq',
  'policy',
  'delivery_area',
  'payment',
  'promotions',
  'cancellation',
  'custom',
])

export const aiKnowledgeEntryChannelSchema = z.enum([
  'whatsapp',
  'digital_menu',
  'delivery',
  'counter',
  'dine_in',
])

// ── Settings ────────────────────────────────────────────────────────

export const updateAiAttendantSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  mode: aiAttendantModeSchema.optional(),
  assistantName: z.string().trim().min(2).max(80).optional(),
  mainPrompt: z.string().trim().min(20).max(4000).optional(),
  minDelaySeconds: z.number().int().min(1).max(120).optional(),
  maxDelaySeconds: z.number().int().min(1).max(300).optional(),
  messageGroupingSeconds: z.number().int().min(1).max(60).optional(),
  answerOnlyDuringBusinessHours: z.boolean().optional(),
  transferOnLowConfidence: z.boolean().optional(),
  transferOnComplaint: z.boolean().optional(),
  transferOnCancellation: z.boolean().optional(),
  transferOnHumanRequest: z.boolean().optional(),
  tone: aiAttendantToneSchema.optional(),
  useEmojis: z.boolean().optional(),
  callCustomerByName: z.boolean().optional(),
  responseLength: aiResponseLengthSchema.optional(),
  neverInventPrice: z.boolean().optional(),
  neverInventProduct: z.boolean().optional(),
  neverInventPromotion: z.boolean().optional(),
  neverPromiseDeliveryTime: z.boolean().optional(),
  allowTestWhatsappSend: z.boolean().optional(),
  defaultTestWhatsappNumber: z.string().trim().max(32).nullable().optional(),
  upsellEnabled: z.boolean().optional(),
  upsellMaxSuggestions: z.number().int().min(0).max(6).optional(),
  greetingMessage: z.string().max(500).nullable().optional(),
  outOfHoursMessage: z.string().max(500).nullable().optional(),
  humanHandoffMessage: z.string().max(500).nullable().optional(),
})

export type UpdateAiAttendantSettingsPayload = z.infer<
  typeof updateAiAttendantSettingsSchema
>

// ── Knowledge ───────────────────────────────────────────────────────

export const createKnowledgeEntrySchema = z.object({
  type: aiKnowledgeEntryTypeSchema,
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(2).max(5000),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  channels: z.array(aiKnowledgeEntryChannelSchema).min(1).optional(),
})

export const updateKnowledgeEntrySchema = z.object({
  type: aiKnowledgeEntryTypeSchema.optional(),
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().trim().min(2).max(5000).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  channels: z.array(aiKnowledgeEntryChannelSchema).min(1).optional(),
})

export type CreateKnowledgeEntryPayload = z.infer<
  typeof createKnowledgeEntrySchema
>
export type UpdateKnowledgeEntryPayload = z.infer<
  typeof updateKnowledgeEntrySchema
>

// ── Test Reply ──────────────────────────────────────────────────────

export const testReplySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  customerId: z.string().uuid().nullable().optional(),
  channel: z.enum(['whatsapp', 'delivery', 'counter', 'dine_in']).optional(),
})

export type TestReplyPayload = z.infer<typeof testReplySchema>

export const testChatMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  customerId: z.string().uuid().nullable().optional(),
  channel: z.enum(['whatsapp', 'delivery', 'counter', 'dine_in']).optional(),
  history: z.array(z.object({
    role: z.enum(['customer', 'ai', 'human', 'system']),
    content: z.string().trim().min(1).max(2000),
    direction: z.enum(['inbound', 'outbound']).optional(),
  })).max(20).optional(),
})

export type TestChatMessagePayload = z.infer<typeof testChatMessageSchema>

export const testWhatsappSendSchema = z.object({
  phone: z.string().trim().min(8).max(24),
  message: z.string().trim().min(1).max(2000),
  simulateCustomerReply: z.string().trim().min(1).max(2000).optional(),
})

export type TestWhatsappSendPayload = z.infer<typeof testWhatsappSendSchema>

// ── Conversations ───────────────────────────────────────────────────

export const sendConversationMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export type SendConversationMessagePayload = z.infer<
  typeof sendConversationMessageSchema
>

// ── Webhook ─────────────────────────────────────────────────────────

export const markOrderDraftConvertedSchema = z.object({
  orderId: z.string().uuid(),
})

export type MarkOrderDraftConvertedPayload = z.infer<
  typeof markOrderDraftConvertedSchema
>

export const whatsappWebhookPayloadSchema = z.object({
  event: z.string(),
  sessionId: z.string().optional(),
  data: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    body: z.string().optional(),
    messageId: z.string().optional(),
    timestamp: z.number().optional(),
    pushName: z.string().optional(),
  }).passthrough().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
})

export type WhatsappWebhookPayload = z.infer<
  typeof whatsappWebhookPayloadSchema
>
