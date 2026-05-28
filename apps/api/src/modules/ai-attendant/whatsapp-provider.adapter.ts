// ── WhatsApp Provider Adapter ───────────────────────────────────────
// Abstract interface for WhatsApp Web session providers.
// Implementations: EvolutionApi, Baileys, WPPConnect, etc.

export interface WhatsappSessionResult {
  sessionId: string
  status: 'waiting_qr' | 'connecting' | 'connected' | 'error'
  message?: string
}

export interface WhatsappQrCodeResult {
  qrCode: string | null
  expiresAt: string | null
  status: 'waiting_qr' | 'connected' | 'expired' | 'error'
  message?: string
}

export interface WhatsappStatusResult {
  status: 'disconnected' | 'waiting_qr' | 'connecting' | 'connected' | 'expired' | 'error'
  phoneNumber?: string
  displayName?: string
  lastError?: string
}

export interface WhatsappSendResult {
  messageId: string
  status: 'sent' | 'queued' | 'failed'
  message?: string
}

export interface WhatsappWebhookResult {
  event: string
  sessionId?: string
  from?: string
  to?: string
  body?: string
  messageId?: string
  timestamp?: number
  pushName?: string
}

export interface WhatsappProviderAdapter {
  readonly providerName: string

  startSession(storeId: string, sessionName: string): Promise<WhatsappSessionResult>

  getQrCode(sessionId: string): Promise<WhatsappQrCodeResult>

  getStatus(sessionId: string): Promise<WhatsappStatusResult>

  disconnect(sessionId: string): Promise<void>

  restartSession(sessionId: string): Promise<WhatsappSessionResult>

  sendMessage(
    sessionId: string,
    to: string,
    message: string,
  ): Promise<WhatsappSendResult>

  handleWebhook(payload: unknown): Promise<WhatsappWebhookResult>
}
