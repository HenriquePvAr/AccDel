// ── AI Attendant Types ──────────────────────────────────────────────

export type AiAttendantMode = 'off' | 'suggestion' | 'automatic' | 'hybrid'
export type AiAttendantTone = 'professional' | 'friendly' | 'casual' | 'premium'
export type AiKnowledgeEntryType = 'store_info' | 'faq' | 'policy' | 'delivery_area' | 'payment' | 'custom'
export type WhatsappSessionStatus = 'disconnected' | 'waiting_qr' | 'connecting' | 'connected' | 'expired' | 'error'
export type WhatsappMessageDirection = 'inbound' | 'outbound'
export type WhatsappMessageSenderType = 'customer' | 'ai' | 'human' | 'system'
export type WhatsappMessageStatus = 'received' | 'queued' | 'sent' | 'failed'
export type AiConversationStatus = 'open' | 'waiting_ai' | 'waiting_human' | 'human_assigned' | 'closed'
export type AiOrderDraftStatus = 'suggested' | 'approved' | 'discarded'

// ── Overview ────────────────────────────────────────────────────────

export interface AiAttendantOverview {
  aiActive: boolean
  mode: AiAttendantMode
  whatsappStatus: WhatsappSessionStatus
  conversationsToday: number
  repliesSentToday: number
  waitingHuman: number
  knowledgeEntries: number
  integrationErrors: number
}

// ── Settings ────────────────────────────────────────────────────────

export interface AiAttendantSettings {
  id: string
  storeId: string
  isEnabled: boolean
  mode: AiAttendantMode
  minDelaySeconds: number
  maxDelaySeconds: number
  messageGroupingSeconds: number
  answerOnlyDuringBusinessHours: boolean
  transferOnLowConfidence: boolean
  transferOnComplaint: boolean
  transferOnCancellation: boolean
  tone: AiAttendantTone
  useEmojis: boolean
  callCustomerByName: boolean
  greetingMessage: string | null
  outOfHoursMessage: string | null
  humanHandoffMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateAiAttendantSettingsPayload {
  isEnabled?: boolean
  mode?: AiAttendantMode
  minDelaySeconds?: number
  maxDelaySeconds?: number
  messageGroupingSeconds?: number
  answerOnlyDuringBusinessHours?: boolean
  transferOnLowConfidence?: boolean
  transferOnComplaint?: boolean
  transferOnCancellation?: boolean
  tone?: AiAttendantTone
  useEmojis?: boolean
  callCustomerByName?: boolean
  greetingMessage?: string | null
  outOfHoursMessage?: string | null
  humanHandoffMessage?: string | null
}

// ── Knowledge Base ──────────────────────────────────────────────────

export interface AiKnowledgeEntry {
  id: string
  storeId: string
  type: AiKnowledgeEntryType
  title: string
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateKnowledgeEntryPayload {
  type: AiKnowledgeEntryType
  title: string
  content: string
  isActive?: boolean
}

export interface UpdateKnowledgeEntryPayload {
  type?: AiKnowledgeEntryType
  title?: string
  content?: string
  isActive?: boolean
}

// ── WhatsApp Session ────────────────────────────────────────────────

export interface WhatsappSession {
  id: string
  storeId: string
  provider: string
  sessionName: string
  phoneNumber: string | null
  displayName: string | null
  status: WhatsappSessionStatus
  qrCode: string | null
  qrCodeExpiresAt: string | null
  lastConnectedAt: string | null
  lastDisconnectedAt: string | null
  isEnabled: boolean
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface WhatsappQrCodeResult {
  qrCode: string | null
  expiresAt: string | null
  status: WhatsappSessionStatus
  message?: string
}

export interface WhatsappStatusResult {
  status: WhatsappSessionStatus
  phoneNumber?: string
  displayName?: string
  lastError?: string
}

// ── Conversations ───────────────────────────────────────────────────

export interface AiMessage {
  id: string
  conversationId: string
  direction: WhatsappMessageDirection
  senderType: WhatsappMessageSenderType
  body: string
  status: WhatsappMessageStatus
  createdAt: string
}

export interface AiOrderDraft {
  id: string
  conversationId: string
  customerId: string | null
  rawText: string
  parsedItems: {
    productName: string
    quantity: number
    notes?: string
    price?: number
  }[]
  missingFields: string[]
  status: AiOrderDraftStatus
  createdAt: string
  updatedAt: string
}

export interface AiConversation {
  id: string
  storeId: string
  whatsappSessionId: string
  customerId: string | null
  whatsappNumber: string
  customerName: string | null
  status: AiConversationStatus
  assignedUserId: string | null
  lastMessageAt: string | null
  lastAiResponseAt: string | null
  createdAt: string
  updatedAt: string
  messages: AiMessage[]
  orderDrafts: AiOrderDraft[]
}

export interface SendConversationMessagePayload {
  body: string
}

// ── Test Reply ──────────────────────────────────────────────────────

export interface TestReplyPayload {
  message: string
}

export interface TestReplyResult {
  reply: string
  confidence: number
  sourcesUsed: string[]
  recommendedAction: 'respond_automatically' | 'request_human_help' | 'ask_more_info'
}
