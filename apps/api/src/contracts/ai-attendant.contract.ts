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

export const aiKnowledgeEntryTypeSchema = z.enum([
  'store_info',
  'faq',
  'policy',
  'delivery_area',
  'payment',
  'custom',
])

// ── Settings ────────────────────────────────────────────────────────

export const updateAiAttendantSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  mode: aiAttendantModeSchema.optional(),
  minDelaySeconds: z.number().int().min(1).max(120).optional(),
  maxDelaySeconds: z.number().int().min(1).max(300).optional(),
  messageGroupingSeconds: z.number().int().min(1).max(60).optional(),
  answerOnlyDuringBusinessHours: z.boolean().optional(),
  transferOnLowConfidence: z.boolean().optional(),
  transferOnComplaint: z.boolean().optional(),
  transferOnCancellation: z.boolean().optional(),
  tone: aiAttendantToneSchema.optional(),
  useEmojis: z.boolean().optional(),
  callCustomerByName: z.boolean().optional(),
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
})

export const updateKnowledgeEntrySchema = z.object({
  type: aiKnowledgeEntryTypeSchema.optional(),
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().trim().min(2).max(5000).optional(),
  isActive: z.boolean().optional(),
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
})

export type TestReplyPayload = z.infer<typeof testReplySchema>

// ── Conversations ───────────────────────────────────────────────────

export const sendConversationMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export type SendConversationMessagePayload = z.infer<
  typeof sendConversationMessageSchema
>

// ── Webhook ─────────────────────────────────────────────────────────

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
