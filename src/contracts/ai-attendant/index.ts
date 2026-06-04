// ── AI Attendant Types ──────────────────────────────────────────────

export type AiAttendantMode = 'off' | 'suggestion' | 'automatic' | 'hybrid'
export type AiAttendantTone = 'professional' | 'friendly' | 'casual' | 'premium'
export type AiResponseLength = 'short' | 'medium' | 'detailed'
export type AiKnowledgeEntryType =
  | 'store_info'
  | 'faq'
  | 'policy'
  | 'delivery_area'
  | 'payment'
  | 'promotions'
  | 'cancellation'
  | 'custom'
export type AiKnowledgeEntryChannel = 'whatsapp' | 'digital_menu' | 'delivery' | 'counter' | 'dine_in'
export type AiTestChannel = 'whatsapp' | 'delivery' | 'counter' | 'dine_in'
export type WhatsappSessionStatus = 'disconnected' | 'waiting_qr' | 'connecting' | 'connected' | 'expired' | 'error'
export type WhatsappMessageDirection = 'inbound' | 'outbound'
export type WhatsappMessageSenderType = 'customer' | 'ai' | 'human' | 'system'
export type WhatsappMessageStatus = 'received' | 'queued' | 'sent' | 'failed'
export type AiConversationStatus = 'open' | 'waiting_ai' | 'waiting_human' | 'human_assigned' | 'closed'
export type AiConversationType = 'real' | 'test'
export type AiOrderDraftStatus = 'suggested' | 'approved' | 'converted' | 'discarded'
export type WhatsappIntegrationLogType =
  | 'provider_status'
  | 'session_started'
  | 'session_disconnected'
  | 'session_restarted'
  | 'qr_requested'
  | 'webhook_received'
  | 'message_received'
  | 'message_sent'
  | 'message_failed'
  | 'ai_reply_generated'
  | 'ai_reply_failed'
  | 'delay_scheduled'
  | 'delay_cancelled'
  | 'human_assigned'
  | 'human_released'
  | 'conversation_closed'
  | 'test_chat'
  | 'test_whatsapp_sent'
export type IntegrationLogStatus = 'info' | 'success' | 'warning' | 'error'

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

export interface AiAttendantDashboard {
  period: {
    today: string
    weekStart: string
  }
  kpis: {
    attendancesToday: number
    attendancesWeek: number
    messagesReceivedToday: number
    messagesSentToday: number
    orderDraftsSuggested: number
    orderDraftsApproved: number
    orderDraftsConverted: number
    transfersToHuman: number
    resolutionRate: number
    averageResponseMs: number | null
    averageHumanTakeoverMs: number | null
  }
  topProducts: {
    productName: string
    quantity: number
    approved: number
  }[]
  topOptions: {
    optionName: string
    quantity: number
    approved: number
  }[]
  topCategories: {
    categoryId: string
    categoryName: string
    quantity: number
    approved: number
  }[]
  topDistricts: {
    district: string
    count: number
  }[]
  provider: {
    whatsapp: {
      provider: string
      status: WhatsappSessionStatus
      phoneNumber: string | null
      displayName: string | null
      lastError: string | null
    } | null
    lastLogs: WhatsappIntegrationLog[]
  }
}

// ── Settings ────────────────────────────────────────────────────────

export interface AiAttendantSettings {
  id: string
  storeId: string
  isEnabled: boolean
  mode: AiAttendantMode
  assistantName: string
  mainPrompt: string
  minDelaySeconds: number
  maxDelaySeconds: number
  messageGroupingSeconds: number
  answerOnlyDuringBusinessHours: boolean
  transferOnLowConfidence: boolean
  transferOnComplaint: boolean
  transferOnCancellation: boolean
  transferOnHumanRequest: boolean
  tone: AiAttendantTone
  useEmojis: boolean
  callCustomerByName: boolean
  responseLength: AiResponseLength
  neverInventPrice: boolean
  neverInventProduct: boolean
  neverInventPromotion: boolean
  neverPromiseDeliveryTime: boolean
  allowTestWhatsappSend: boolean
  defaultTestWhatsappNumber: string | null
  upsellEnabled: boolean
  upsellMaxSuggestions: number
  greetingMessage: string | null
  outOfHoursMessage: string | null
  humanHandoffMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateAiAttendantSettingsPayload {
  isEnabled?: boolean
  mode?: AiAttendantMode
  assistantName?: string
  mainPrompt?: string
  minDelaySeconds?: number
  maxDelaySeconds?: number
  messageGroupingSeconds?: number
  answerOnlyDuringBusinessHours?: boolean
  transferOnLowConfidence?: boolean
  transferOnComplaint?: boolean
  transferOnCancellation?: boolean
  transferOnHumanRequest?: boolean
  tone?: AiAttendantTone
  useEmojis?: boolean
  callCustomerByName?: boolean
  responseLength?: AiResponseLength
  neverInventPrice?: boolean
  neverInventProduct?: boolean
  neverInventPromotion?: boolean
  neverPromiseDeliveryTime?: boolean
  allowTestWhatsappSend?: boolean
  defaultTestWhatsappNumber?: string | null
  upsellEnabled?: boolean
  upsellMaxSuggestions?: number
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
  priority: number
  channels: AiKnowledgeEntryChannel[]
  createdAt: string
  updatedAt: string
}

export interface CreateKnowledgeEntryPayload {
  type: AiKnowledgeEntryType
  title: string
  content: string
  isActive?: boolean
  priority?: number
  channels?: AiKnowledgeEntryChannel[]
}

export interface UpdateKnowledgeEntryPayload {
  type?: AiKnowledgeEntryType
  title?: string
  content?: string
  isActive?: boolean
  priority?: number
  channels?: AiKnowledgeEntryChannel[]
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

export interface WhatsappIntegrationLog {
  id: string
  storeId: string
  sessionId: string | null
  type: WhatsappIntegrationLogType
  status: IntegrationLogStatus
  message: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

// ── Conversations ───────────────────────────────────────────────────

export interface AiMessage {
  id: string
  conversationId: string
  direction: WhatsappMessageDirection
  senderType: WhatsappMessageSenderType
  body: string
  status: WhatsappMessageStatus
  scheduledSendAt: string | null
  sentAt: string | null
  failedAt: string | null
  errorMessage: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AiOrderDraft {
  id: string
  conversationId: string
  customerId: string | null
  rawText: string
  parsedItems: {
    productId?: string
    productName: string
    quantity: number
    options?: {
      groupId?: string
      groupName?: string
      optionId?: string
      optionName?: string
      quantity?: number
      price?: number
    }[]
    addons?: {
      productId?: string
      productName: string
      quantity: number
      notes?: string
      price?: number
    }[]
    notes?: string
    price?: number
  }[]
  missingFields: string[]
  metadata: Record<string, unknown> | null
  status: AiOrderDraftStatus
  approvedAt: string | null
  convertedOrderId: string | null
  createdAt: string
  updatedAt: string
}

export interface PreparedAiOrderDraft {
  draftId: string
  conversationId: string
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  addressId: string | null
  channel: 'delivery'
  paymentMethod: 'pix'
  notes: string
  items: {
    productId: string
    name: string
    quantity: number
    unitPrice: number
    notes?: string
    options: {
      id: string
      groupId: string
      groupName: string
      name: string
      quantity: number
      price: number
    }[]
  }[]
  unresolvedItems: {
    productId: null
    productName: string
    quantity: number
    notes?: string
    reason: string
  }[]
  missingFields: string[]
}

export interface AiConversation {
  id: string
  storeId: string
  whatsappSessionId: string
  customerId: string | null
  whatsappNumber: string
  customerName: string | null
  type: AiConversationType
  status: AiConversationStatus
  assignedUserId: string | null
  assignedAt: string | null
  unreadCount: number
  isAiPaused: boolean
  lastStatus: string | null
  lastError: string | null
  lastMessageAt: string | null
  lastAiResponseAt: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    phone: string
    notes: string | null
    tags: string[]
    addresses: {
      id: string
      label: string
      street: string
      number: string
      district: string
      complement: string | null
      city: string
      state: string
      reference: string | null
    }[]
    orders: {
      id: string
      number: string
      status: string
      source: string
      serviceType: string
      total: number
      paymentMethod: string
      createdAt: string
      items: {
        id: string
        name: string
        quantity: number
        unitPrice: number
        notes: string | null
      }[]
    }[]
  } | null
  messages: AiMessage[]
  orderDrafts: AiOrderDraft[]
}

export interface SendConversationMessagePayload {
  body: string
}

// ── Test Reply ──────────────────────────────────────────────────────

export interface TestReplyPayload {
  message: string
  customerId?: string | null
  channel?: AiTestChannel
}

export interface TestChatMessagePayload {
  message: string
  customerId?: string | null
  channel?: AiTestChannel
  history?: {
    role: 'customer' | 'ai' | 'human' | 'system'
    content: string
    direction?: WhatsappMessageDirection
  }[]
}

export interface TestWhatsappSendPayload {
  phone: string
  message: string
  simulateCustomerReply?: string
}

export interface TestReplyResult {
  reply: string
  intent: string
  confidence: number
  shouldTransferToHuman: boolean
  transferReason: string | null
  sourcesUsed: string[]
  recommendedAction: 'respond_automatically' | 'request_human_help' | 'ask_more_info'
  orderDraft: {
    rawText?: string
    parsedItems: {
      productId?: string
      productName: string
      quantity: number
      options?: {
        groupId?: string
        groupName?: string
        optionId?: string
        optionName?: string
        quantity?: number
        price?: number
      }[]
      addons?: {
        productId?: string
        productName: string
        quantity: number
        notes?: string
        price?: number
      }[]
      notes?: string
      price?: number
    }[]
    missingFields: string[]
  } | null
}

export interface TestChatMessageResult extends TestReplyResult {
  responseMs: number
}
