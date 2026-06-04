import type {
  AiAttendantOverview,
  AiAttendantDashboard,
  AiAttendantSettings,
  AiConversation,
  AiKnowledgeEntry,
  AiOrderDraft,
  PreparedAiOrderDraft,
  CreateKnowledgeEntryPayload,
  SendConversationMessagePayload,
  TestChatMessagePayload,
  TestChatMessageResult,
  TestReplyPayload,
  TestReplyResult,
  TestWhatsappSendPayload,
  UpdateAiAttendantSettingsPayload,
  UpdateKnowledgeEntryPayload,
  WhatsappIntegrationLog,
  WhatsappQrCodeResult,
  WhatsappSession,
  WhatsappStatusResult,
} from '@/contracts/ai-attendant'
import { apiClient } from '@/services/http/api-client'

export const aiAttendantService = {
  // ── Overview ────────────────────────────────────────────────────────

  async getOverview(): Promise<AiAttendantOverview> {
    return apiClient.get<AiAttendantOverview>('/ai-attendant/overview')
  },

  async getDashboard(): Promise<AiAttendantDashboard> {
    return apiClient.get<AiAttendantDashboard>('/ai-attendant/dashboard')
  },

  // ── Settings ────────────────────────────────────────────────────────

  async getSettings(): Promise<AiAttendantSettings> {
    return apiClient.get<AiAttendantSettings>('/ai-attendant/settings')
  },

  async updateSettings(payload: UpdateAiAttendantSettingsPayload): Promise<AiAttendantSettings> {
    return apiClient.patch<AiAttendantSettings>('/ai-attendant/settings', payload)
  },

  // ── Knowledge Base ──────────────────────────────────────────────────

  async getKnowledgeEntries(): Promise<AiKnowledgeEntry[]> {
    return apiClient.get<AiKnowledgeEntry[]>('/ai-attendant/knowledge')
  },

  async createKnowledgeEntry(payload: CreateKnowledgeEntryPayload): Promise<AiKnowledgeEntry> {
    return apiClient.post<AiKnowledgeEntry>('/ai-attendant/knowledge', payload)
  },

  async updateKnowledgeEntry(
    id: string,
    payload: UpdateKnowledgeEntryPayload,
  ): Promise<AiKnowledgeEntry> {
    return apiClient.patch<AiKnowledgeEntry>(`/ai-attendant/knowledge/${id}`, payload)
  },

  async deleteKnowledgeEntry(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/ai-attendant/knowledge/${id}`)
  },

  // ── Test Reply ──────────────────────────────────────────────────────

  async testReply(payload: TestReplyPayload): Promise<TestReplyResult> {
    return apiClient.post<TestReplyResult>('/ai-attendant/test-reply', payload)
  },

  async testChatMessage(payload: TestChatMessagePayload): Promise<TestChatMessageResult> {
    return apiClient.post<TestChatMessageResult>('/ai-attendant/test-chat/message', payload)
  },

  async sendTestWhatsappMessage(payload: TestWhatsappSendPayload): Promise<AiConversation> {
    return apiClient.post<AiConversation>('/ai-attendant/test-whatsapp/send', payload)
  },

  // ── WhatsApp Session ────────────────────────────────────────────────

  async getSession(): Promise<WhatsappSession | null> {
    return apiClient.get<WhatsappSession | null>('/ai-attendant/whatsapp/session')
  },

  async startSession(): Promise<{ sessionId: string; status: string; message?: string }> {
    return apiClient.post<{ sessionId: string; status: string; message?: string }>(
      '/ai-attendant/whatsapp/session/start',
    )
  },

  async getQrCode(): Promise<WhatsappQrCodeResult> {
    return apiClient.get<WhatsappQrCodeResult>('/ai-attendant/whatsapp/session/qr')
  },

  async getSessionStatus(): Promise<WhatsappStatusResult> {
    return apiClient.get<WhatsappStatusResult>('/ai-attendant/whatsapp/session/status')
  },

  async disconnectSession(): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>('/ai-attendant/whatsapp/session/disconnect')
  },

  async restartSession(): Promise<{ sessionId: string; status: string; message?: string }> {
    return apiClient.post<{ sessionId: string; status: string; message?: string }>(
      '/ai-attendant/whatsapp/session/restart',
    )
  },

  async getWhatsappLogs(): Promise<WhatsappIntegrationLog[]> {
    return apiClient.get<WhatsappIntegrationLog[]>('/ai-attendant/whatsapp/logs')
  },

  // ── Conversations ───────────────────────────────────────────────────

  async getConversations(): Promise<AiConversation[]> {
    return apiClient.get<AiConversation[]>('/ai-attendant/conversations')
  },

  async getConversationDetail(id: string): Promise<AiConversation> {
    return apiClient.get<AiConversation>(`/ai-attendant/conversations/${id}`)
  },

  async assignConversation(id: string, userId: string): Promise<AiConversation> {
    return apiClient.post<AiConversation>(`/ai-attendant/conversations/${id}/assign`, { userId })
  },

  async releaseConversation(id: string): Promise<AiConversation> {
    return apiClient.post<AiConversation>(`/ai-attendant/conversations/${id}/release`)
  },

  async sendManualMessage(
    id: string,
    payload: SendConversationMessagePayload,
  ): Promise<AiConversation> {
    return apiClient.post<AiConversation>(`/ai-attendant/conversations/${id}/send`, payload)
  },

  async closeConversation(id: string): Promise<AiConversation> {
    return apiClient.post<AiConversation>(`/ai-attendant/conversations/${id}/close`)
  },

  // ── Order Drafts ────────────────────────────────────────────────────

  async getOrderDrafts(): Promise<AiOrderDraft[]> {
    return apiClient.get<AiOrderDraft[]>('/ai-attendant/order-drafts')
  },

  async approveOrderDraft(id: string): Promise<AiOrderDraft> {
    return apiClient.post<AiOrderDraft>(`/ai-attendant/order-drafts/${id}/approve`)
  },

  async discardOrderDraft(id: string): Promise<AiOrderDraft> {
    return apiClient.post<AiOrderDraft>(`/ai-attendant/order-drafts/${id}/discard`)
  },

  async prepareOrderDraft(id: string): Promise<PreparedAiOrderDraft> {
    return apiClient.post<PreparedAiOrderDraft>(`/ai-attendant/order-drafts/${id}/prepare-order`)
  },

  async markOrderDraftConverted(id: string, orderId: string): Promise<AiOrderDraft> {
    return apiClient.post<AiOrderDraft>(`/ai-attendant/order-drafts/${id}/mark-converted`, {
      orderId,
    })
  },
}
