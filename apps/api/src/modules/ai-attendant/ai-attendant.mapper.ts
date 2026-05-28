import {
  AiAttendantSettings,
  AiKnowledgeEntry,
  AiConversation,
  AiMessage,
  WhatsappSession,
  AiOrderDraft,
} from '@prisma/client'

export class AiAttendantMapper {
  static toSettingsDto(settings: AiAttendantSettings | null) {
    if (!settings) return null
    return {
      id: settings.id,
      storeId: settings.storeId,
      isEnabled: settings.isEnabled,
      mode: settings.mode,
      minDelaySeconds: settings.minDelaySeconds,
      maxDelaySeconds: settings.maxDelaySeconds,
      messageGroupingSeconds: settings.messageGroupingSeconds,
      answerOnlyDuringBusinessHours: settings.answerOnlyDuringBusinessHours,
      transferOnLowConfidence: settings.transferOnLowConfidence,
      transferOnComplaint: settings.transferOnComplaint,
      transferOnCancellation: settings.transferOnCancellation,
      tone: settings.tone,
      useEmojis: settings.useEmojis,
      callCustomerByName: settings.callCustomerByName,
      greetingMessage: settings.greetingMessage,
      outOfHoursMessage: settings.outOfHoursMessage,
      humanHandoffMessage: settings.humanHandoffMessage,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    }
  }

  static toKnowledgeDto(entry: AiKnowledgeEntry) {
    return {
      id: entry.id,
      storeId: entry.storeId,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      isActive: entry.isActive,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }
  }

  static toSessionDto(session: WhatsappSession | null) {
    if (!session) return null
    return {
      id: session.id,
      storeId: session.storeId,
      provider: session.provider,
      sessionName: session.sessionName,
      phoneNumber: session.phoneNumber,
      displayName: session.displayName,
      status: session.status,
      qrCode: session.qrCode, // Safe to send to admin client
      qrCodeExpiresAt: session.qrCodeExpiresAt,
      lastConnectedAt: session.lastConnectedAt,
      lastDisconnectedAt: session.lastDisconnectedAt,
      isEnabled: session.isEnabled,
      lastError: session.lastError,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }
  }

  static toConversationDto(
    conversation: AiConversation & {
      messages?: AiMessage[]
      orderDrafts?: AiOrderDraft[]
    },
  ) {
    return {
      id: conversation.id,
      storeId: conversation.storeId,
      whatsappSessionId: conversation.whatsappSessionId,
      customerId: conversation.customerId,
      whatsappNumber: conversation.whatsappNumber,
      customerName: conversation.customerName,
      status: conversation.status,
      assignedUserId: conversation.assignedUserId,
      lastMessageAt: conversation.lastMessageAt,
      lastAiResponseAt: conversation.lastAiResponseAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages?.map((m) => this.toMessageDto(m)) || [],
      orderDrafts: conversation.orderDrafts?.map((d) => this.toOrderDraftDto(d)) || [],
    }
  }

  static toMessageDto(message: AiMessage) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      senderType: message.senderType,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt,
    }
  }

  static toOrderDraftDto(draft: AiOrderDraft) {
    return {
      id: draft.id,
      conversationId: draft.conversationId,
      customerId: draft.customerId,
      rawText: draft.rawText,
      parsedItems: typeof draft.parsedItems === 'string'
        ? JSON.parse(draft.parsedItems)
        : draft.parsedItems,
      missingFields: typeof draft.missingFields === 'string'
        ? JSON.parse(draft.missingFields)
        : draft.missingFields,
      status: draft.status,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }
  }
}
