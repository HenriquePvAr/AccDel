// ── AI Provider Adapter ─────────────────────────────────────────────
// Abstract interface for AI providers.
// Implementations: Lovable, OpenAI, Custom, etc.

export interface AiReplyContext {
  message: string
  conversationHistory: {
    role: 'customer' | 'ai' | 'human' | 'system'
    content: string
  }[]
  storeName: string
  catalogContext: string
  settingsContext: string
  knowledgeEntriesContext: string
}

export interface AiReplyResult {
  reply: string
  confidence: number // 0.0 to 1.0
  sourcesUsed: string[]
  recommendedAction: 'respond_automatically' | 'request_human_help' | 'ask_more_info'
}

export interface AiClassificationResult {
  intent: 'order' | 'question' | 'complaint' | 'cancellation' | 'human_request' | 'other'
  confidence: number
}

export interface AiOrderDraftResult {
  parsedItems: {
    productName: string
    quantity: number
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
