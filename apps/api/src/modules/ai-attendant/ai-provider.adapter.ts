// ── AI Provider Adapter ─────────────────────────────────────────────
// Abstract interface for AI providers.
// Implementations: Lovable, OpenAI, Custom, etc.

export interface AiReplyContext {
  conversationId: string
  storeId: string
  channel: 'whatsapp' | 'delivery' | 'counter' | 'dine_in'
  orderMode: 'delivery' | 'pickup' | 'counter' | 'dine_in'
  message: string
  customer: {
    name: string | null
    phone: string | null
  }
  conversationHistory: {
    role: 'customer' | 'ai' | 'human' | 'system'
    content: string
    direction?: 'inbound' | 'outbound'
  }[]
  storeName: string
  systemPrompt: string
  catalogContext: string
  settingsContext: string
  knowledgeEntriesContext: string
}

export interface AiOrderDraftSuggestion {
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
}

export interface AiReplyResult {
  reply: string
  intent: string
  confidence: number // 0.0 to 1.0
  shouldTransferToHuman: boolean
  transferReason: string | null
  sourcesUsed: string[]
  recommendedAction: 'respond_automatically' | 'request_human_help' | 'ask_more_info'
  orderDraft: AiOrderDraftSuggestion | null
}

export interface AiClassificationResult {
  intent: 'order' | 'question' | 'complaint' | 'cancellation' | 'human_request' | 'other'
  confidence: number
}

export interface AiOrderDraftResult {
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
    notes?: string
    price?: number
  }[]
  missingFields: string[] // e.g. "address", "payment_method", "options"
}

export interface AiProviderAdapter {
  readonly providerName: string

  generateReply(context: AiReplyContext): Promise<AiReplyResult>

  classifyMessage(message: string): Promise<AiClassificationResult>

  extractOrderDraft(
    message: string,
    catalogContext: string,
  ): Promise<AiOrderDraftResult>
}
