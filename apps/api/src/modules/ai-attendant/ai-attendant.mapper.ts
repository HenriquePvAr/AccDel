import {
  AiAttendantSettings,
  AiKnowledgeEntry,
  AiConversation,
  AiMessage,
  WhatsappSession,
  AiOrderDraft,
  WhatsappIntegrationLog,
  Customer,
  CustomerAddress,
  Order,
  OrderItem,
} from '@prisma/client'

type ConversationCustomer = Customer & {
  addresses?: CustomerAddress[]
  orders?: Array<Order & { items?: OrderItem[] }>
}

export class AiAttendantMapper {
  static toSettingsDto(settings: AiAttendantSettings | null) {
    if (!settings) return null
    return {
      id: settings.id,
      storeId: settings.storeId,
      isEnabled: settings.isEnabled,
      mode: settings.mode,
      assistantName: settings.assistantName,
      mainPrompt: settings.mainPrompt,
      minDelaySeconds: settings.minDelaySeconds,
      maxDelaySeconds: settings.maxDelaySeconds,
      messageGroupingSeconds: settings.messageGroupingSeconds,
      answerOnlyDuringBusinessHours: settings.answerOnlyDuringBusinessHours,
      transferOnLowConfidence: settings.transferOnLowConfidence,
      transferOnComplaint: settings.transferOnComplaint,
      transferOnCancellation: settings.transferOnCancellation,
      transferOnHumanRequest: settings.transferOnHumanRequest,
      tone: settings.tone,
      useEmojis: settings.useEmojis,
      callCustomerByName: settings.callCustomerByName,
      responseLength: settings.responseLength,
      neverInventPrice: settings.neverInventPrice,
      neverInventProduct: settings.neverInventProduct,
      neverInventPromotion: settings.neverInventPromotion,
      neverPromiseDeliveryTime: settings.neverPromiseDeliveryTime,
      allowTestWhatsappSend: settings.allowTestWhatsappSend,
      defaultTestWhatsappNumber: settings.defaultTestWhatsappNumber,
      upsellEnabled: settings.upsellEnabled,
      upsellMaxSuggestions: settings.upsellMaxSuggestions,
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
      priority: entry.priority,
      channels: entry.channels,
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
      customer?: ConversationCustomer | null
    },
  ) {
    return {
      id: conversation.id,
      storeId: conversation.storeId,
      whatsappSessionId: conversation.whatsappSessionId,
      customerId: conversation.customerId,
      whatsappNumber: conversation.whatsappNumber,
      customerName: conversation.customerName,
      type: conversation.type,
      status: conversation.status,
      assignedUserId: conversation.assignedUserId,
      assignedAt: conversation.assignedAt,
      unreadCount: conversation.unreadCount,
      isAiPaused: conversation.isAiPaused,
      lastStatus: conversation.lastStatus,
      lastError: conversation.lastError,
      lastMessageAt: conversation.lastMessageAt,
      lastAiResponseAt: conversation.lastAiResponseAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      customer: conversation.customer
        ? {
            id: conversation.customer.id,
            name: conversation.customer.name,
            phone: conversation.customer.phone,
            notes: conversation.customer.notes,
            tags: conversation.customer.tags,
            addresses: conversation.customer.addresses?.map((address) => ({
              id: address.id,
              label: address.label,
              street: address.street,
              number: address.number,
              district: address.district,
              complement: address.complement,
              city: address.city,
              state: address.state,
              reference: address.reference,
            })) || [],
            orders: conversation.customer.orders?.map((order) => ({
              id: order.id,
              number: order.number,
              status: order.status,
              source: order.source,
              serviceType: order.serviceType,
              total: order.total.toNumber(),
              paymentMethod: order.paymentMethod,
              createdAt: order.createdAt,
              items: order.items?.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toNumber(),
                notes: item.notes,
              })) || [],
            })) || [],
          }
        : null,
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
      scheduledSendAt: message.scheduledSendAt,
      sentAt: message.sentAt,
      failedAt: message.failedAt,
      errorMessage: message.errorMessage,
      metadata: message.metadata,
      createdAt: message.createdAt,
    }
  }

  static toIntegrationLogDto(log: WhatsappIntegrationLog) {
    return {
      id: log.id,
      storeId: log.storeId,
      sessionId: log.sessionId,
      type: log.type,
      status: log.status,
      message: log.message,
      metadata: log.metadata,
      createdAt: log.createdAt,
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
      metadata: draft.metadata,
      status: draft.status,
      approvedAt: draft.approvedAt,
      convertedOrderId: draft.convertedOrderId,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }
  }
}
