import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaService } from '../../shared/prisma/prisma.service'
import { WhatsappProviderFactory } from './whatsapp-provider.factory'
import { AiProviderFactory } from './ai-provider.factory'
import { AiAttendantMapper } from './ai-attendant.mapper'
import { AiPromptBuilderService, DEFAULT_AI_MAIN_PROMPT } from './ai-prompt-builder.service'
import { AiOrderStatusService } from './ai-order-status.service'
import { LovableSupabaseIntegrationService } from './lovable-supabase-integration.service'
import { AiReplyResult } from './ai-provider.adapter'
import {
  UpdateAiAttendantSettingsPayload,
  CreateKnowledgeEntryPayload,
  TestChatMessagePayload,
  TestReplyPayload,
  TestWhatsappSendPayload,
  UpdateKnowledgeEntryPayload,
  WhatsappWebhookPayload,
} from '../../contracts/ai-attendant.contract'
import {
  Prisma,
  WhatsappSessionStatus,
  WhatsappMessageStatus,
  WhatsappMessageSenderType,
  WhatsappIntegrationLogType,
  IntegrationLogStatus,
} from '@prisma/client'
import { isMessageWebhookEvent } from './webhook-security.service'
import { WebhookReceiptService } from './webhook-receipt.service'
import { MessagingOutboxService } from '@/modules/messaging/application/messaging-outbox.service'

interface AiOrderDraftParsedOption {
  groupId?: string
  groupName?: string
  optionId?: string
  optionName?: string
  quantity?: number
  price?: number
}

interface AiOrderDraftParsedItem {
  productId?: string
  productName: string
  quantity: number
  options?: AiOrderDraftParsedOption[]
  addons?: AiOrderDraftParsedItem[]
  notes?: string
  price?: number
}

interface PreparedAiOrderDraftItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
  missingFields?: string[]
  options: {
    id: string
    groupId: string
    groupName: string
    name: string
    quantity: number
    price: number
  }[]
}

interface UnresolvedAiOrderDraftItem {
  productId: null
  productName: string
  quantity: number
  notes?: string
  reason: string
}

@Injectable()
export class AiAttendantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappFactory: WhatsappProviderFactory,
    private readonly aiFactory: AiProviderFactory,
    private readonly promptBuilder: AiPromptBuilderService,
    private readonly orderStatusService: AiOrderStatusService,
    private readonly lovableSupabaseIntegration: LovableSupabaseIntegrationService,
    private readonly webhookReceiptService: WebhookReceiptService,
    private readonly configService: ConfigService,
    private readonly messagingOutbox: MessagingOutboxService,
  ) {}

  // ── Overview & Statistics ──────────────────────────────────────────

  async getOverview(storeId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      settings,
      session,
      conversationsCount,
      messagesTodayCount,
      waitingHumanCount,
      knowledgeCount,
    ] = await Promise.all([
      this.getOrCreateSettings(storeId),
      this.getSession(storeId),
      this.prisma.aiConversation.count({
        where: { storeId, createdAt: { gte: today } },
      }),
      this.prisma.aiMessage.count({
        where: {
          conversation: { storeId },
          createdAt: { gte: today },
          direction: 'outbound',
          senderType: 'ai',
        },
      }),
      this.prisma.aiConversation.count({
        where: { storeId, operationalStatus: 'WAITING_HUMAN' },
      }),
      this.prisma.aiKnowledgeEntry.count({
        where: { storeId, isActive: true },
      }),
    ])

    return {
      aiActive: settings.isEnabled,
      mode: settings.mode,
      whatsappStatus: session?.status || 'disconnected',
      conversationsToday: conversationsCount,
      repliesSentToday: messagesTodayCount,
      waitingHuman: waitingHumanCount,
      knowledgeEntries: knowledgeCount,
      integrationErrors: session?.status === 'error' ? 1 : 0,
    }
  }

  async getDashboard(storeId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6)

    const [
      conversationsToday,
      conversationsWeek,
      inboundToday,
      outboundToday,
      orderDraftsSuggested,
      orderDraftsApproved,
      orderDraftsConverted,
      transfersToHuman,
      closedConversationsWeek,
      conversationsWeekList,
      logsToday,
      sessions,
      activeDrafts,
      conversationsWithCustomer,
      catalogProductsForDashboard,
    ] = await Promise.all([
      this.prisma.aiConversation.count({ where: { storeId, createdAt: { gte: today } } }),
      this.prisma.aiConversation.count({ where: { storeId, createdAt: { gte: weekStart } } }),
      this.prisma.aiMessage.count({
        where: { conversation: { storeId }, direction: 'inbound', createdAt: { gte: today } },
      }),
      this.prisma.aiMessage.count({
        where: { conversation: { storeId }, direction: 'outbound', createdAt: { gte: today } },
      }),
      this.prisma.aiOrderDraft.count({
        where: { conversation: { storeId }, createdAt: { gte: weekStart } },
      }),
      this.prisma.aiOrderDraft.count({
        where: { conversation: { storeId }, status: 'approved', updatedAt: { gte: weekStart } },
      }),
      this.prisma.aiOrderDraft.count({
        where: { conversation: { storeId }, convertedOrderId: { not: null }, updatedAt: { gte: weekStart } },
      }),
      this.prisma.whatsappIntegrationLog.count({
        where: { storeId, type: 'human_assigned', createdAt: { gte: weekStart } },
      }),
      this.prisma.aiConversation.count({
        where: { storeId, status: 'closed', updatedAt: { gte: weekStart } },
      }),
      this.prisma.aiConversation.findMany({
        where: { storeId, createdAt: { gte: weekStart } },
        select: {
          id: true,
          assignedAt: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              direction: true,
              senderType: true,
              createdAt: true,
            },
          },
        },
        take: 300,
      }),
      this.prisma.whatsappIntegrationLog.findMany({
        where: { storeId, createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.whatsappSession.findMany({
        where: { storeId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      }),
      this.prisma.aiOrderDraft.findMany({
        where: { conversation: { storeId }, createdAt: { gte: weekStart } },
        select: {
          parsedItems: true,
          status: true,
        },
        take: 300,
      }),
      this.prisma.aiConversation.findMany({
        where: { storeId, customerId: { not: null } },
        select: {
          customer: {
            select: {
              addresses: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { district: true },
              },
            },
          },
        },
        take: 300,
      }),
      this.prisma.product.findMany({
        where: { storeId },
        select: {
          id: true,
          name: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ])

    const averageResponseMs = this.calculateAverageAiResponseMs(conversationsWeekList)
    const averageHumanTakeoverMs = this.calculateAverageHumanTakeoverMs(conversationsWeekList)
    const topProducts = this.calculateDraftProducts(activeDrafts)
    const topOptions = this.calculateDraftOptions(activeDrafts)
    const topCategories = this.calculateDraftCategories(activeDrafts, catalogProductsForDashboard)
    const topDistricts = this.calculateTopDistricts(conversationsWithCustomer)
    const resolutionRate = conversationsWeek > 0 ? closedConversationsWeek / conversationsWeek : 0

    return {
      period: {
        today: today.toISOString(),
        weekStart: weekStart.toISOString(),
      },
      kpis: {
        attendancesToday: conversationsToday,
        attendancesWeek: conversationsWeek,
        messagesReceivedToday: inboundToday,
        messagesSentToday: outboundToday,
        orderDraftsSuggested,
        orderDraftsApproved,
        orderDraftsConverted,
        transfersToHuman,
        resolutionRate,
        averageResponseMs,
        averageHumanTakeoverMs,
      },
      topProducts,
      topOptions,
      topCategories,
      topDistricts,
      provider: {
        whatsapp: sessions[0]
          ? {
              provider: sessions[0].provider,
              status: sessions[0].status,
              phoneNumber: sessions[0].phoneNumber,
              displayName: sessions[0].displayName,
              lastError: sessions[0].lastError,
            }
          : null,
        lastLogs: logsToday.map((log) => AiAttendantMapper.toIntegrationLogDto(log)),
      },
    }
  }

  // ── Settings ────────────────────────────────────────────────────────

  private calculateAverageAiResponseMs(
    conversations: {
      messages: {
        direction: 'inbound' | 'outbound'
        senderType: 'customer' | 'ai' | 'human' | 'system'
        createdAt: Date
      }[]
    }[],
  ) {
    const responseTimes: number[] = []

    conversations.forEach((conversation) => {
      conversation.messages.forEach((message, index) => {
        if (message.direction !== 'outbound' || message.senderType !== 'ai') {
          return
        }

        const previousInbound = conversation.messages
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.direction === 'inbound')

        if (previousInbound) {
          responseTimes.push(message.createdAt.getTime() - previousInbound.createdAt.getTime())
        }
      })
    })

    if (!responseTimes.length) {
      return null
    }

    return Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
  }

  private calculateAverageHumanTakeoverMs(
    conversations: {
      createdAt: Date
      assignedAt: Date | null
    }[],
  ) {
    const takeoverTimes = conversations
      .filter((conversation) => conversation.assignedAt)
      .map((conversation) => conversation.assignedAt!.getTime() - conversation.createdAt.getTime())
      .filter((value) => value >= 0)

    if (!takeoverTimes.length) {
      return null
    }

    return Math.round(takeoverTimes.reduce((sum, value) => sum + value, 0) / takeoverTimes.length)
  }

  private calculateDraftProducts(
    drafts: {
      parsedItems: Prisma.JsonValue
      status: 'suggested' | 'approved' | 'converted' | 'discarded'
    }[],
  ) {
    const counts = new Map<string, { productName: string; quantity: number; approved: number }>()

    drafts.forEach((draft) => {
      parseOrderDraftItems(draft.parsedItems).forEach((item) => {
        const current = counts.get(item.productName) ?? {
          productName: item.productName,
          quantity: 0,
          approved: 0,
        }
        current.quantity += item.quantity
        if (draft.status === 'approved' || draft.status === 'converted') {
          current.approved += item.quantity
        }
        counts.set(item.productName, current)
      })
    })

    return [...counts.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8)
  }

  private calculateDraftOptions(
    drafts: {
      parsedItems: Prisma.JsonValue
      status: 'suggested' | 'approved' | 'converted' | 'discarded'
    }[],
  ) {
    const counts = new Map<string, { optionName: string; quantity: number; approved: number }>()

    drafts.forEach((draft) => {
      parseOrderDraftItems(draft.parsedItems).forEach((item) => {
        item.options?.forEach((option) => {
          const optionName = option.optionName ?? option.groupName
          if (!optionName) {
            return
          }

          const current = counts.get(optionName.toLowerCase()) ?? {
            optionName,
            quantity: 0,
            approved: 0,
          }
          current.quantity += option.quantity ?? 1
          if (draft.status === 'approved' || draft.status === 'converted') {
            current.approved += option.quantity ?? 1
          }
          counts.set(optionName.toLowerCase(), current)
        })
      })
    })

    return [...counts.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8)
  }

  private calculateDraftCategories(
    drafts: {
      parsedItems: Prisma.JsonValue
      status: 'suggested' | 'approved' | 'converted' | 'discarded'
    }[],
    products: {
      id: string
      name: string
      category: {
        id: string
        name: string
      }
    }[],
  ) {
    const productsById = new Map(products.map((product) => [product.id, product]))
    const productsByName = new Map(
      products.map((product) => [product.name.trim().toLowerCase(), product]),
    )
    const counts = new Map<
      string,
      { categoryId: string; categoryName: string; quantity: number; approved: number }
    >()

    drafts.forEach((draft) => {
      parseOrderDraftItems(draft.parsedItems).forEach((item) => {
        const product = item.productId
          ? productsById.get(item.productId)
          : productsByName.get(item.productName.trim().toLowerCase())

        if (!product) {
          return
        }

        const current = counts.get(product.category.id) ?? {
          categoryId: product.category.id,
          categoryName: product.category.name,
          quantity: 0,
          approved: 0,
        }
        current.quantity += item.quantity
        if (draft.status === 'approved' || draft.status === 'converted') {
          current.approved += item.quantity
        }
        counts.set(product.category.id, current)
      })
    })

    return [...counts.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8)
  }

  private calculateTopDistricts(
    conversations: {
      customer: {
        addresses: {
          district: string
        }[]
      } | null
    }[],
  ) {
    const counts = new Map<string, number>()

    conversations.forEach((conversation) => {
      const district = conversation.customer?.addresses[0]?.district?.trim()
      if (district) {
        counts.set(district, (counts.get(district) ?? 0) + 1)
      }
    })

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([district, count]) => ({ district, count }))
  }

  getLovableSupabaseStatus() {
    return this.lovableSupabaseIntegration.getStatus()
  }

  testLovableSupabaseConnection() {
    return this.lovableSupabaseIntegration.testConnection()
  }

  async getOrCreateSettings(storeId: string) {
    let settings = await this.prisma.aiAttendantSettings.findUnique({
      where: { storeId },
    })

    if (!settings) {
      settings = await this.prisma.aiAttendantSettings.create({
        data: {
          storeId,
          isEnabled: false,
          mode: 'off',
          assistantName: 'Atendente Cain',
          mainPrompt: DEFAULT_AI_MAIN_PROMPT,
          minDelaySeconds: 8,
          maxDelaySeconds: 25,
          messageGroupingSeconds: 6,
          answerOnlyDuringBusinessHours: true,
          transferOnLowConfidence: true,
          transferOnComplaint: true,
          transferOnCancellation: true,
          transferOnHumanRequest: true,
          tone: 'friendly',
          useEmojis: true,
          callCustomerByName: true,
          responseLength: 'medium',
          neverInventPrice: true,
          neverInventProduct: true,
          neverInventPromotion: true,
          neverPromiseDeliveryTime: true,
          allowTestWhatsappSend: false,
          defaultTestWhatsappNumber: null,
          upsellEnabled: true,
          upsellMaxSuggestions: 2,
          greetingMessage: 'Olá! Como posso te ajudar hoje?',
          outOfHoursMessage: 'Olá! No momento estamos fechados. Responderemos assim que reabrirmos.',
          humanHandoffMessage: 'Entendido. Estou transferindo você para um de nossos atendentes humanos.',
        },
      })
    }

    return settings
  }

  async updateSettings(storeId: string, payload: UpdateAiAttendantSettingsPayload) {
    await this.getOrCreateSettings(storeId)

    const updated = await this.prisma.aiAttendantSettings.update({
      where: { storeId },
      data: payload,
    })

    return AiAttendantMapper.toSettingsDto(updated)
  }

  // ── Knowledge CRUD ──────────────────────────────────────────────────

  async getKnowledgeEntries(storeId: string) {
    const entries = await this.prisma.aiKnowledgeEntry.findMany({
      where: { storeId },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    })
    return entries.map((e) => AiAttendantMapper.toKnowledgeDto(e))
  }

  async createKnowledgeEntry(storeId: string, payload: CreateKnowledgeEntryPayload) {
    const entry = await this.prisma.aiKnowledgeEntry.create({
      data: {
        storeId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        isActive: payload.isActive ?? true,
        priority: payload.priority ?? 0,
        channels: payload.channels ?? ['whatsapp'],
      },
    })
    return AiAttendantMapper.toKnowledgeDto(entry)
  }

  async updateKnowledgeEntry(
    storeId: string,
    id: string,
    payload: UpdateKnowledgeEntryPayload,
  ) {
    const entry = await this.prisma.aiKnowledgeEntry.findFirst({
      where: { id, storeId },
    })

    if (!entry) {
      throw new HttpException('Knowledge entry not found.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiKnowledgeEntry.update({
      where: { id },
      data: {
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.content !== undefined ? { content: payload.content } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        ...(payload.channels !== undefined ? { channels: payload.channels } : {}),
      },
    })

    return AiAttendantMapper.toKnowledgeDto(updated)
  }

  async deleteKnowledgeEntry(storeId: string, id: string) {
    const entry = await this.prisma.aiKnowledgeEntry.findFirst({
      where: { id, storeId },
    })

    if (!entry) {
      throw new HttpException('Knowledge entry not found.', HttpStatus.NOT_FOUND)
    }

    await this.prisma.aiKnowledgeEntry.delete({
      where: { id },
    })

    return { success: true }
  }

  // ── Test Reply Pipeline ─────────────────────────────────────────────

  async testReply(storeId: string, payload: TestReplyPayload) {
    const customerPhone = await this.resolveCustomerPhoneForStatus(storeId, payload.customerId)
    const statusResult = await this.orderStatusService.resolve({
      storeId,
      message: payload.message,
      customerPhone,
    })

    if (statusResult) {
      return statusResult
    }

    const aiProvider = this.aiFactory.getProvider()
    const promptContext = await this.promptBuilder.build({
      storeId,
      conversationId: 'test-reply',
      message: payload.message,
      customerId: payload.customerId ?? null,
      channel: payload.channel ?? 'whatsapp',
      conversationHistory: [],
    })

    const result = await aiProvider.generateReply(promptContext.replyContext)

    return result
  }

  async testChatMessage(storeId: string, payload: TestChatMessagePayload) {
    const startedAt = Date.now()
    const customerPhone = await this.resolveCustomerPhoneForStatus(storeId, payload.customerId)
    const statusResult = await this.orderStatusService.resolve({
      storeId,
      message: payload.message,
      customerPhone,
    })

    if (statusResult) {
      const responseMs = Date.now() - startedAt
      await this.writeIntegrationLog({
        storeId,
        type: 'test_chat',
        status: 'success',
        message: `Consulta deterministica de status gerada em ${responseMs}ms.`,
        metadata: {
          provider: 'deterministic_order_status',
          responseMs,
          intent: statusResult.intent,
          confidence: statusResult.confidence,
        },
      })

      return {
        ...statusResult,
        responseMs,
      }
    }

    const aiProvider = this.aiFactory.getProvider()
    const promptContext = await this.promptBuilder.build({
      storeId,
      conversationId: 'test-chat',
      message: payload.message,
      customerId: payload.customerId ?? null,
      channel: payload.channel ?? 'whatsapp',
      conversationHistory: payload.history ?? [],
    })

    const result = await aiProvider.generateReply(promptContext.replyContext)
    const responseMs = Date.now() - startedAt

    await this.writeIntegrationLog({
      storeId,
      type: 'test_chat',
      status: 'success',
      message: `Teste de IA simulado gerado em ${responseMs}ms.`,
      metadata: {
        provider: aiProvider.providerName,
        responseMs,
        intent: result.intent,
        confidence: result.confidence,
      },
    })

    return {
      ...result,
      responseMs,
    }
  }

  async sendTestWhatsappMessage(storeId: string, payload: TestWhatsappSendPayload) {
    const settings = await this.getOrCreateSettings(storeId)

    if (!settings.allowTestWhatsappSend) {
      throw new HttpException(
        'Envio para numero de teste esta desativado nas configuracoes do Atendente IA.',
        HttpStatus.BAD_REQUEST,
      )
    }

    const phone = this.normalizeSingleWhatsappNumber(payload.phone)
    const session = await this.prisma.whatsappSession.findFirst({ where: { storeId } })

    if (!session || session.status !== 'connected') {
      throw new HttpException(
        'WhatsApp nao conectado. Conecte a sessao antes de enviar teste real.',
        HttpStatus.BAD_REQUEST,
      )
    }

    let conversation = await this.prisma.aiConversation.findFirst({
      where: { storeId, whatsappNumber: phone, type: 'test' },
    })

    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({
        data: {
          storeId,
          whatsappSessionId: session.id,
          whatsappNumber: phone,
          customerName: 'Numero de teste',
          type: 'test',
          status: 'human_assigned',
          assignedUserId: 'test_operator',
          assignedAt: new Date(),
          isAiPaused: true,
          unreadCount: 0,
          lastStatus: 'Conversa real de teste criada. IA pausada por seguranca.',
          lastMessageAt: new Date(),
        },
      })
    } else {
      conversation = await this.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: {
          status: 'human_assigned',
          assignedUserId: conversation.assignedUserId ?? 'test_operator',
          assignedAt: conversation.assignedAt ?? new Date(),
          isAiPaused: true,
          lastStatus: 'Teste WhatsApp real enviado. IA pausada por seguranca.',
          lastError: null,
          lastMessageAt: new Date(),
        },
      })
    }

    await this.sendDirectReply(
      storeId,
      session.sessionName,
      conversation.id,
      phone,
      payload.message,
      'human',
      undefined,
      {
        metadata: {
          test: true,
          source: 'test_whatsapp',
        },
      },
    )

    if (payload.simulateCustomerReply?.trim()) {
      const simulatedBody = payload.simulateCustomerReply.trim()
      await this.prisma.whatsappMessage.create({
        data: {
          storeId,
          sessionId: session.id,
          conversationId: conversation.id,
          fromNumber: phone,
          toNumber: session.phoneNumber || 'store',
          direction: 'inbound',
          senderType: 'customer',
          body: simulatedBody,
          status: 'received',
          metadata: {
            test: true,
            simulated: true,
          },
        },
      })
      await this.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          senderType: 'customer',
          body: simulatedBody,
          status: 'received',
          metadata: {
            test: true,
            simulated: true,
          },
        },
      })
      await this.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastStatus: 'Resposta do cliente simulada no teste WhatsApp.',
        },
      })
    }

    await this.writeIntegrationLog({
      storeId,
      sessionId: session.id,
      type: 'test_whatsapp_sent',
      status: 'success',
      message: `Teste WhatsApp real enviado para ${this.maskPhone(phone)}.`,
      metadata: {
        conversationId: conversation.id,
        hasSimulatedReply: Boolean(payload.simulateCustomerReply?.trim()),
      },
    })

    return this.getConversationDetail(storeId, conversation.id)
  }

  private async resolveCustomerPhoneForStatus(storeId: string, customerId?: string | null) {
    if (!customerId) {
      return null
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId,
      },
      select: {
        phone: true,
      },
    })

    return customer?.phone ?? null
  }

  // ── WhatsApp Session Lifecycle ──────────────────────────────────────

  async getSession(storeId: string) {
    if (this.isCloudWhatsappProvider()) {
      const account = await this.prisma.messagingAccount.findFirst({
        where: { storeId, provider: 'whatsapp_cloud', enabled: true },
      })
      const now = new Date()
      return {
        id: account?.id ?? 'whatsapp-cloud-configured',
        storeId,
        provider: 'whatsapp_cloud',
        sessionName: 'WhatsApp Cloud API',
        phoneNumber: account?.displayPhoneNumber ?? null,
        displayName: 'Meta WhatsApp Cloud API',
        status: account ? 'connected' : 'connecting',
        qrCode: null,
        qrCodeExpiresAt: null,
        lastConnectedAt: account?.updatedAt ?? null,
        lastDisconnectedAt: null,
        isEnabled: true,
        lastError: account ? null : 'Configuracao carregada; aguardando o primeiro webhook valido da Meta.',
        createdAt: account?.createdAt ?? now,
        updatedAt: account?.updatedAt ?? now,
      }
    }

    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session && this.whatsappFactory.getProvider().providerName === 'unconfigured') {
      const now = new Date()
      return {
        id: 'unconfigured',
        storeId,
        provider: 'unconfigured',
        sessionName: `session_${storeId}`,
        phoneNumber: null,
        displayName: null,
        status: 'error',
        qrCode: null,
        qrCodeExpiresAt: null,
        lastConnectedAt: null,
        lastDisconnectedAt: null,
        isEnabled: false,
        lastError: 'Provider de WhatsApp nao configurado nas variaveis de ambiente da API.',
        createdAt: now,
        updatedAt: now,
      }
    }

    return AiAttendantMapper.toSessionDto(session)
  }

  async getWhatsappLogs(storeId: string) {
    const logs = await this.prisma.whatsappIntegrationLog.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })

    return logs.map((log) => AiAttendantMapper.toIntegrationLogDto(log))
  }

  async startSession(storeId: string) {
    if (this.isCloudWhatsappProvider()) {
      throw new HttpException(
        'WhatsApp Cloud API nao usa sessao ou QR Code. Configure o webhook no Meta Business.',
        HttpStatus.CONFLICT,
      )
    }
    const provider = this.whatsappFactory.getProvider()
    const sessionName = `session_${storeId}`

    let session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session) {
      session = await this.prisma.whatsappSession.create({
        data: {
          storeId,
          provider: provider.providerName,
          sessionName,
          status: 'connecting',
        },
      })
    } else {
      await this.prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          provider: provider.providerName,
          sessionName,
          status: 'connecting',
          lastError: null,
        },
      })
    }

    try {
      const result = await provider.startSession(storeId, sessionName)

      await this.prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          provider: provider.providerName,
          sessionName,
          status: result.status as WhatsappSessionStatus,
          lastError: result.status === 'error' ? result.message || null : null,
        },
      })

      await this.writeIntegrationLog({
        storeId,
        sessionId: session.id,
        type: 'session_started',
        status: result.status === 'error' ? 'error' : 'success',
        message: result.message ?? `Sessao WhatsApp atualizada para ${result.status}.`,
        metadata: { provider: provider.providerName, sessionStatus: result.status },
      })

      return result
    } catch (error: unknown) {
      const message = this.getSafeErrorMessage(error, 'Nao foi possivel iniciar a sessao.')
      await this.prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          status: 'error',
          lastError: message,
        },
      })
      await this.writeIntegrationLog({
        storeId,
        sessionId: session.id,
        type: 'session_started',
        status: 'error',
        message,
        metadata: { provider: provider.providerName },
      })
      throw error
    }
  }

  async getQrCode(storeId: string) {
    if (this.isCloudWhatsappProvider()) {
      throw new HttpException(
        'WhatsApp Cloud API nao usa QR Code.',
        HttpStatus.CONFLICT,
      )
    }
    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session) {
      throw new HttpException('Sessão não iniciada.', HttpStatus.BAD_REQUEST)
    }

    const provider = this.whatsappFactory.getProvider()
    const result = await provider.getQrCode(session.sessionName)

    await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        qrCode: result.qrCode,
        qrCodeExpiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
        status: result.status === 'connected' ? 'connected' : session.status,
      },
    })

    await this.writeIntegrationLog({
      storeId,
      sessionId: session.id,
      type: 'qr_requested',
      status: result.qrCode ? 'success' : result.status === 'connected' ? 'success' : 'warning',
      message: result.qrCode
        ? 'QR Code real retornado pelo provider.'
        : result.message ?? `Provider retornou status ${result.status} sem QR Code.`,
      metadata: {
        providerStatus: result.status,
        expiresAt: result.expiresAt,
        hasQrCode: Boolean(result.qrCode),
      },
    })

    return result
  }

  async getSessionStatus(storeId: string) {
    if (this.isCloudWhatsappProvider()) {
      const account = await this.prisma.messagingAccount.findFirst({
        where: { storeId, provider: 'whatsapp_cloud', enabled: true },
      })
      return {
        status: account ? 'connected' : 'connecting',
        displayName: 'Meta WhatsApp Cloud API',
        phoneNumber: account?.displayPhoneNumber ?? undefined,
        lastError: account ? undefined : 'Aguardando o primeiro webhook valido da Meta.',
      }
    }
    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session) {
      return { status: 'disconnected' }
    }

    const provider = this.whatsappFactory.getProvider()
    const result = await provider.getStatus(session.sessionName)

    await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        status: result.status as WhatsappSessionStatus,
        phoneNumber: result.phoneNumber || session.phoneNumber,
        displayName: result.displayName || session.displayName,
        lastError: result.lastError || null,
        lastConnectedAt: result.status === 'connected' ? new Date() : session.lastConnectedAt,
        lastDisconnectedAt: result.status === 'disconnected' ? new Date() : session.lastDisconnectedAt,
      },
    })

    if (result.status === 'error' || result.lastError) {
      await this.writeIntegrationLog({
        storeId,
        sessionId: session.id,
        type: 'provider_status',
        status: 'error',
        message: result.lastError ?? 'Provider retornou status de erro.',
        metadata: { providerStatus: result.status },
      })
    }

    return result
  }

  async disconnectSession(storeId: string) {
    if (this.isCloudWhatsappProvider()) {
      throw new HttpException(
        'Desative a integracao Cloud por configuracao e no Meta Business, nao por sessao local.',
        HttpStatus.CONFLICT,
      )
    }
    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session) {
      throw new HttpException('Sessão não encontrada.', HttpStatus.NOT_FOUND)
    }

    const provider = this.whatsappFactory.getProvider()
    await provider.disconnect(session.sessionName)

    await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        status: 'disconnected',
        qrCode: null,
        qrCodeExpiresAt: null,
        lastDisconnectedAt: new Date(),
      },
    })

    await this.writeIntegrationLog({
      storeId,
      sessionId: session.id,
      type: 'session_disconnected',
      status: 'success',
      message: 'Sessao WhatsApp desconectada pelo sistema.',
    })

    return { success: true }
  }

  async restartSession(storeId: string) {
    if (this.isCloudWhatsappProvider()) {
      throw new HttpException(
        'WhatsApp Cloud API nao possui sessao local para reiniciar.',
        HttpStatus.CONFLICT,
      )
    }
    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session) {
      throw new HttpException('Sessão não encontrada.', HttpStatus.NOT_FOUND)
    }

    const provider = this.whatsappFactory.getProvider()
    const result = await provider.restartSession(session.sessionName)

    await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        status: result.status as WhatsappSessionStatus,
        lastError: result.message || null,
      },
    })

    await this.writeIntegrationLog({
      storeId,
      sessionId: session.id,
      type: 'session_restarted',
      status: result.status === 'error' ? 'error' : 'success',
      message: result.message ?? `Sessao reiniciada com status ${result.status}.`,
      metadata: { providerStatus: result.status },
    })

    return result
  }

  // ── Webhook message receiver ────────────────────────────────────────

  async handleIncomingWebhook(payload: WhatsappWebhookPayload) {
    const provider = this.whatsappFactory.getProvider()
    const norm = await provider.handleWebhook(payload)

    if (!isMessageWebhookEvent(norm.event)) {
      return { success: true, ignored: true, reason: 'unsupported_event' }
    }

    if (!norm.sessionId) {
      throw new HttpException('Evento sem sessao identificavel.', HttpStatus.BAD_REQUEST)
    }

    if (!norm.messageId) {
      throw new HttpException(
        'Evento de mensagem sem identificador externo.',
        HttpStatus.BAD_REQUEST,
      )
    }

    // Locate session inside store
    const session = await this.prisma.whatsappSession.findFirst({
      where: { sessionName: norm.sessionId },
    })

    if (!session) {
      throw new HttpException('Sessao do webhook nao encontrada.', HttpStatus.NOT_FOUND)
    }
    if (!norm.from || !norm.body) {
      throw new HttpException('Evento sem remetente ou mensagem.', HttpStatus.BAD_REQUEST)
    }

    const storeId = session.storeId
    const cleanNumber = norm.from.replace(/\D/g, '')
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          event: norm.event,
          sessionId: norm.sessionId,
          messageId: norm.messageId,
          from: cleanNumber,
          body: norm.body,
          timestamp: norm.timestamp,
        }),
      )
      .digest('hex')

    const receipt = await this.webhookReceiptService.claim({
      storeId,
      sessionId: session.id,
      provider: provider.providerName,
      eventId: norm.messageId,
      requestHash,
    })

    if (receipt.duplicate) {
      return { success: true, duplicate: true }
    }

    await this.writeIntegrationLog({
      storeId,
      sessionId: session.id,
      type: 'webhook_received',
      status: 'success',
      message: `Webhook recebido do provider: ${norm.event}.`,
      metadata: {
        event: norm.event,
        hasMessage: Boolean(norm.body),
        from: this.maskPhone(cleanNumber),
      },
    })

    // Find customer by phone
    let customer = await this.prisma.customer.findFirst({
      where: { storeId, phone: cleanNumber },
    })

    if (!customer && norm.pushName) {
      // Optional: Auto create simple customer profile or keep it null
      customer = await this.prisma.customer.create({
        data: {
          storeId,
          phone: cleanNumber,
          name: norm.pushName || cleanNumber,
        },
      })
    }

    // Find or create conversation
    let conversation = await this.prisma.aiConversation.findFirst({
      where: { storeId, whatsappNumber: cleanNumber },
    })

    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({
        data: {
          storeId,
          whatsappSessionId: session.id,
          customerId: customer?.id || null,
          whatsappNumber: cleanNumber,
          customerName: customer?.name || norm.pushName || cleanNumber,
          type: 'real',
          status: 'open',
          unreadCount: 1,
          isAiPaused: false,
          lastStatus: 'Mensagem recebida do WhatsApp.',
          lastError: null,
          lastMessageAt: new Date(),
        },
      })
    } else {
      conversation = await this.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          status: conversation.status === 'closed' ? 'open' : conversation.status,
          unreadCount: { increment: 1 },
          lastStatus: 'Mensagem recebida do WhatsApp.',
          lastError: null,
        },
      })
    }

    // Save received whatsapp message
    await this.prisma.whatsappMessage.create({
      data: {
        storeId,
        sessionId: session.id,
        conversationId: conversation.id,
        externalMessageId: norm.messageId || null,
        fromNumber: cleanNumber,
        toNumber: session.phoneNumber || 'store',
        direction: 'inbound',
        senderType: 'customer',
        body: norm.body,
        status: 'received',
      },
    })

    // Save AI Attendant transcript message
    await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        senderType: 'customer',
        body: norm.body,
        status: 'received',
      },
    })

    await this.writeIntegrationLog({
      storeId,
      sessionId: session.id,
      type: 'message_received',
      status: 'success',
      message: `Mensagem recebida de ${customer?.name ?? this.maskPhone(cleanNumber)}.`,
      metadata: {
        conversationId: conversation.id,
        messageId: norm.messageId,
        conversationType: conversation.type,
      },
    })

    // Process AI pipeline asynchronously if active
    const settings = await this.getOrCreateSettings(storeId)

    if (
      settings.isEnabled &&
      settings.mode !== 'off' &&
      conversation.status !== 'human_assigned' &&
      !conversation.isAiPaused
    ) {
      this.triggerAiPipeline(storeId, conversation.id, norm.body, cleanNumber, session.sessionName)
    } else {
      // Mark as waiting human if AI is off/hybrid but assigned user is not present
      if (conversation.status !== 'human_assigned') {
        await this.prisma.aiConversation.update({
          where: { id: conversation.id },
          data: {
            status: 'waiting_human',
            lastStatus: conversation.isAiPaused
              ? 'IA pausada nesta conversa.'
              : 'IA desligada ou em modo off.',
          },
        })
      }
    }

    return { success: true }
  }

  // ── AI Response Generation and Humanized Delay Pipeline ─────────────

  private async triggerAiPipeline(
    storeId: string,
    conversationId: string,
    messageBody: string,
    cleanNumber: string,
    sessionName: string,
  ) {
    try {
      const settings = await this.getOrCreateSettings(storeId)

      // 1. Classify intention
      const aiProvider = this.aiFactory.getProvider()
      const classification = await aiProvider.classifyMessage(messageBody)

      // Auto transfer rules
      let shouldTransfer = false
      if (settings.transferOnComplaint && classification.intent === 'complaint') shouldTransfer = true
      if (settings.transferOnCancellation && classification.intent === 'cancellation') shouldTransfer = true
      if (settings.transferOnHumanRequest && classification.intent === 'human_request') shouldTransfer = true

      if (shouldTransfer) {
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: {
            status: 'waiting_human',
            isAiPaused: true,
            lastStatus: `Transferido para humano por ${classification.intent}.`,
            lastError: null,
          },
        })

        await this.writeIntegrationLog({
          storeId,
          type: 'human_assigned',
          status: 'warning',
          message: `IA pausada por regra de transferencia: ${classification.intent}.`,
          metadata: { conversationId, intent: classification.intent },
        })

        if (settings.humanHandoffMessage) {
          await this.sendDirectReply(storeId, sessionName, conversationId, cleanNumber, settings.humanHandoffMessage, 'system')
        }
        return
      }

      const conversation = await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
      })

      if (!conversation) {
        return
      }

      // Fetch history
      const history = await this.prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      const formattedHistory = history.reverse().map((h) => ({
        role: h.senderType,
        content: h.body,
        direction: h.direction,
      }))

      // 2. Answer deterministic order-status questions before handing free text to the AI.
      const statusResult = await this.orderStatusService.resolve({
        storeId,
        message: messageBody,
        customerPhone: cleanNumber,
      })
      const aiResult = statusResult
        ? statusResult
        : await aiProvider.generateReply(
            (
              await this.promptBuilder.build({
                conversationId,
                storeId,
                message: messageBody,
                customerId: conversation.customerId,
                customerName: conversation.customerName,
                customerPhone: cleanNumber,
                channel: 'whatsapp',
                conversationHistory: formattedHistory,
              })
            ).replyContext,
          )

      await this.writeIntegrationLog({
        storeId,
        type: 'ai_reply_generated',
        status: 'success',
        message: `Resposta da IA gerada com confianca ${Math.round(aiResult.confidence * 100)}%.`,
        metadata: {
          conversationId,
          intent: aiResult.intent,
          confidence: aiResult.confidence,
          shouldTransferToHuman: aiResult.shouldTransferToHuman,
          provider: statusResult ? 'deterministic_order_status' : aiProvider.providerName,
        },
      })

      await this.saveOrderDraftFromAiResult(
        conversationId,
        conversation.customerId,
        messageBody,
        aiResult,
      )

      const shouldTransferToHuman =
        aiResult.shouldTransferToHuman ||
        (settings.transferOnLowConfidence && aiResult.confidence < 0.6)

      // Transfer if confidence low
      if (shouldTransferToHuman) {
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: {
            status: 'waiting_human',
            isAiPaused: true,
            lastStatus: aiResult.transferReason ?? 'IA solicitou transferencia para humano.',
            lastError: null,
          },
        })

        await this.saveQueuedAiMessage(conversationId, aiResult)

        await this.writeIntegrationLog({
          storeId,
          type: 'human_assigned',
          status: 'warning',
          message: aiResult.transferReason ?? 'IA solicitou transferencia para humano.',
          metadata: {
            conversationId,
            confidence: aiResult.confidence,
            intent: aiResult.intent,
          },
        })

        if (settings.humanHandoffMessage) {
          await this.sendDirectReply(
            storeId,
            sessionName,
            conversationId,
            cleanNumber,
            settings.humanHandoffMessage,
            'system',
          )
        }
        return
      }

      // Handle Sugestão mode: does not send automatically
      if (settings.mode === 'suggestion') {
        await this.saveQueuedAiMessage(conversationId, aiResult)
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: {
            status: 'waiting_ai',
            lastStatus: 'Resposta gerada como sugestao; envio automatico bloqueado pelo modo sugestao.',
            lastError: null,
          },
        })
        return
      }

      // Simulate humanized delay
      const delayMs =
        Math.floor(
          Math.random() * (settings.maxDelaySeconds - settings.minDelaySeconds + 1) +
            settings.minDelaySeconds,
        ) * 1000
      const scheduledSendAt = new Date(Date.now() + delayMs)
      const scheduledMessage = await this.saveScheduledAiMessage(
        conversationId,
        aiResult,
        scheduledSendAt,
      )

      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          status: 'waiting_ai',
          lastStatus: `IA respondera em ${Math.round(delayMs / 1000)} segundos.`,
          lastError: null,
        },
      })

      await this.writeIntegrationLog({
        storeId,
        type: 'delay_scheduled',
        status: 'info',
        message: `Envio da IA agendado para ${Math.round(delayMs / 1000)} segundos.`,
        metadata: {
          conversationId,
          scheduledSendAt: scheduledSendAt.toISOString(),
          delaySeconds: Math.round(delayMs / 1000),
        },
      })

      setTimeout(async () => {
        // Double check conversation status before dispatching
        const currentConv = await this.prisma.aiConversation.findUnique({
          where: { id: conversationId },
        })

        if (!currentConv || currentConv.status === 'human_assigned' || currentConv.isAiPaused) {
          await this.prisma.aiMessage.update({
            where: { id: scheduledMessage.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
              errorMessage: 'Envio cancelado porque humano assumiu ou IA foi pausada.',
            },
          })
          await this.writeIntegrationLog({
            storeId,
            type: 'delay_cancelled',
            status: 'warning',
            message: 'Envio automatico cancelado porque humano assumiu ou IA foi pausada.',
            metadata: { conversationId },
          })
          return
        }

        await this.sendDirectReply(
          storeId,
          sessionName,
          conversationId,
          cleanNumber,
          aiResult.reply,
          'ai',
          this.buildAiMessageRawPayload(aiResult),
          {
            aiMessageId: scheduledMessage.id,
            scheduledSendAt,
          },
        )
      }, delayMs)
    } catch (error: unknown) {
      // Gracefully handle to prevent webhook crashes, record last error to session
      const message = error instanceof Error ? error.message : 'Unknown AI pipeline error.'
      const session = await this.prisma.whatsappSession.findFirst({
        where: { storeId },
      })
      if (session) {
        await this.prisma.whatsappSession.update({
          where: { id: session.id },
          data: { lastError: `AI Pipeline error: ${message}` },
        })
      }
      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          status: 'waiting_human',
          isAiPaused: true,
          lastStatus: 'Pipeline de IA falhou; aguardando humano.',
          lastError: message,
        },
      })
      await this.writeIntegrationLog({
        storeId,
        sessionId: session?.id,
        type: 'ai_reply_failed',
        status: 'error',
        message,
        metadata: { conversationId },
      })
    }
  }

  private buildAiMessageRawPayload(aiResult: AiReplyResult): Prisma.InputJsonValue {
    return {
      provider: 'ai',
      intent: aiResult.intent,
      confidence: aiResult.confidence,
      shouldTransferToHuman: aiResult.shouldTransferToHuman,
      transferReason: aiResult.transferReason,
      sourcesUsed: aiResult.sourcesUsed,
      recommendedAction: aiResult.recommendedAction,
      orderDraft: aiResult.orderDraft
        ? {
            rawText: aiResult.orderDraft.rawText ?? null,
            parsedItems: aiResult.orderDraft.parsedItems.map((item) => ({
              productId: item.productId ?? null,
              productName: item.productName,
              quantity: item.quantity,
              options: item.options?.map((option) => ({
                groupId: option.groupId ?? null,
                groupName: option.groupName ?? null,
                optionId: option.optionId ?? null,
                optionName: option.optionName ?? null,
                quantity: option.quantity ?? null,
                price: option.price ?? null,
              })) ?? [],
              addons: item.addons?.map((addon) => ({
                productId: addon.productId ?? null,
                productName: addon.productName,
                quantity: addon.quantity,
                notes: addon.notes ?? null,
                price: addon.price ?? null,
              })) ?? [],
              notes: item.notes ?? null,
              price: item.price ?? null,
            })),
            missingFields: aiResult.orderDraft.missingFields,
          }
        : null,
    }
  }

  private async saveQueuedAiMessage(conversationId: string, aiResult: AiReplyResult) {
    await this.prisma.aiMessage.create({
      data: {
        conversationId,
        direction: 'outbound',
        senderType: 'ai',
        body: aiResult.reply,
        rawPayload: this.buildAiMessageRawPayload(aiResult),
        status: 'queued',
      },
    })
  }

  private async saveScheduledAiMessage(
    conversationId: string,
    aiResult: AiReplyResult,
    scheduledSendAt: Date,
  ) {
    return this.prisma.aiMessage.create({
      data: {
        conversationId,
        direction: 'outbound',
        senderType: 'ai',
        body: aiResult.reply,
        rawPayload: this.buildAiMessageRawPayload(aiResult),
        status: 'queued',
        scheduledSendAt,
        metadata: {
          delayStatus: 'scheduled',
        },
      },
    })
  }

  private async saveOrderDraftFromAiResult(
    conversationId: string,
    customerId: string | null,
    rawText: string,
    aiResult: AiReplyResult,
  ) {
    if (!aiResult.orderDraft) {
      return
    }

    await this.prisma.aiOrderDraft.create({
      data: {
        conversationId,
        customerId,
        rawText: aiResult.orderDraft.rawText ?? rawText,
        parsedItems: aiResult.orderDraft.parsedItems,
        missingFields: aiResult.orderDraft.missingFields,
        metadata: {
          intent: aiResult.intent,
          confidence: aiResult.confidence,
          sourcesUsed: aiResult.sourcesUsed,
          recommendedAction: aiResult.recommendedAction,
          shouldTransferToHuman: aiResult.shouldTransferToHuman,
        },
        status: 'suggested',
      },
    })
  }

  private async sendDirectReply(
    storeId: string,
    sessionName: string,
    conversationId: string,
    to: string,
    messageText: string,
    senderType: WhatsappMessageSenderType,
    rawPayload?: Prisma.InputJsonValue,
    options?: {
      aiMessageId?: string
      scheduledSendAt?: Date
      metadata?: Prisma.InputJsonValue
    },
  ) {
    const provider = this.whatsappFactory.getProvider()
    const sendResult = await provider.sendMessage(sessionName, to, messageText)
    const status = sendResult.status as WhatsappMessageStatus
    const now = new Date()
    const failed = status === 'failed'
    const errorMessage = failed
      ? sendResult.message ?? 'Provider de WhatsApp retornou falha no envio.'
      : null

    // Save outbound messages
    const session = await this.prisma.whatsappSession.findFirst({
      where: { sessionName },
    })

    if (session) {
      await this.prisma.whatsappMessage.create({
        data: {
          storeId,
          sessionId: session.id,
          conversationId,
          externalMessageId: sendResult.messageId || null,
          fromNumber: session.phoneNumber || 'store',
          toNumber: to,
          direction: 'outbound',
          senderType,
          body: messageText,
          rawPayload,
          status,
          scheduledSendAt: options?.scheduledSendAt,
          sentAt: status === 'sent' ? now : null,
          failedAt: failed ? now : null,
          errorMessage,
          metadata: options?.metadata,
        },
      })
    }

    if (options?.aiMessageId) {
      await this.prisma.aiMessage.update({
        where: { id: options.aiMessageId },
        data: {
          rawPayload,
          status,
          sentAt: status === 'sent' ? now : null,
          failedAt: failed ? now : null,
          errorMessage,
          metadata: options.metadata,
        },
      })
    } else {
      await this.prisma.aiMessage.create({
        data: {
          conversationId,
          direction: 'outbound',
          senderType,
          body: messageText,
          rawPayload,
          status,
          scheduledSendAt: options?.scheduledSendAt,
          sentAt: status === 'sent' ? now : null,
          failedAt: failed ? now : null,
          errorMessage,
          metadata: options?.metadata,
        },
      })
    }

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastAiResponseAt: senderType === 'ai' ? new Date() : undefined,
        status: senderType === 'ai' && status === 'sent' ? 'open' : undefined,
        lastStatus: failed
          ? 'Falha no envio da mensagem pelo provider WhatsApp.'
          : `${senderType === 'ai' ? 'IA' : senderType === 'human' ? 'Humano' : 'Sistema'} enviou mensagem.`,
        lastError: errorMessage,
      },
    })

    await this.writeIntegrationLog({
      storeId,
      sessionId: session?.id,
      type: failed ? 'message_failed' : 'message_sent',
      status: failed ? 'error' : 'success',
      message: failed
        ? errorMessage ?? 'Falha no envio da mensagem.'
        : `Mensagem ${senderType} enviada para ${this.maskPhone(to)}.`,
      metadata: {
        conversationId,
        messageId: sendResult.messageId,
        senderType,
        provider: provider.providerName,
      },
    })

    if (failed) {
      throw new HttpException(
        errorMessage ?? 'Provider de WhatsApp retornou falha no envio.',
        HttpStatus.BAD_GATEWAY,
      )
    }
  }

  // ── Conversation Manual Operations ──────────────────────────────────

  async getConversations(storeId: string) {
    const conversations = await this.prisma.aiConversation.findMany({
      where: { storeId },
      include: this.getConversationInclude(),
      orderBy: { lastMessageAt: 'desc' },
    })

    return conversations.map((c) => AiAttendantMapper.toConversationDto(c))
  }

  async getConversationDetail(storeId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
      include: this.getConversationInclude(),
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    if (conversation.unreadCount > 0) {
      const updated = await this.prisma.aiConversation.update({
        where: { id },
        data: { unreadCount: 0 },
        include: this.getConversationInclude(),
      })
      return AiAttendantMapper.toConversationDto(updated)
    }

    return AiAttendantMapper.toConversationDto(conversation)
  }

  async assignConversation(storeId: string, id: string, userId: string) {
    await this.assertActiveMembership(storeId, userId)
    const updated = await this.activateHumanConversation(
      storeId,
      id,
      userId,
      'Humano assumiu a conversa; IA pausada.',
    )

    await this.writeIntegrationLog({
      storeId,
      type: 'human_assigned',
      status: 'success',
      message: 'Conversa assumida por humano; IA pausada.',
      metadata: { conversationId: id, userId },
    })

    return AiAttendantMapper.toConversationDto(updated)
  }

  async releaseConversation(storeId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiConversation.update({
      where: { id },
      data: {
        status: 'open',
        operationalStatus: 'AI_ACTIVE',
        assignedUserId: null,
        assignedAt: null,
        isAiPaused: false,
        lastStatus: 'Conversa devolvida para IA.',
        lastError: null,
      },
      include: this.getConversationInclude(),
    })

    await this.writeIntegrationLog({
      storeId,
      type: 'human_released',
      status: 'success',
      message: 'Conversa devolvida para IA.',
      metadata: { conversationId: id },
    })

    return AiAttendantMapper.toConversationDto(updated)
  }

  async sendManualMessage(
    storeId: string,
    id: string,
    body: string,
    userId: string,
    idempotencyKey?: string,
  ) {
    await this.assertActiveMembership(storeId, userId)
    const requestKey = idempotencyKey?.trim()
    if (requestKey && !/^[A-Za-z0-9._:-]{8,120}$/.test(requestKey)) {
      throw new HttpException('Idempotency-Key invalida.', HttpStatus.BAD_REQUEST)
    }
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
      include: { messagingAccount: true },
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    await this.activateHumanConversation(
      storeId,
      id,
      userId,
      'Humano enviou mensagem; IA pausada nesta conversa.',
    )

    const provider = this.configService.get<string>('WHATSAPP_PROVIDER')?.trim()
    if (provider === 'cloud' || provider === 'whatsapp_cloud') {
      if (!conversation.messagingAccount) {
        throw new HttpException('Conta WhatsApp Cloud nao vinculada.', HttpStatus.BAD_REQUEST)
      }
      await this.messagingOutbox.enqueueText({
        storeId,
        accountId: conversation.messagingAccount.id,
        conversationId: id,
        recipient: conversation.whatsappNumber,
        body,
        idempotencyKey: `human:${id}:${requestKey || randomUUID()}`,
        senderType: 'human',
      })
    } else {
      const session = await this.prisma.whatsappSession.findFirst({ where: { storeId } })
      if (!session || session.status !== 'connected') {
        throw new HttpException(
          'Cannot send message: WhatsApp is not connected.',
          HttpStatus.BAD_REQUEST,
        )
      }
      await this.sendDirectReply(
        storeId,
        session.sessionName,
        id,
        conversation.whatsappNumber,
        body,
        'human',
      )
    }

    const reloaded = await this.getConversationDetail(storeId, id)
    return reloaded
  }

  async closeConversation(storeId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiConversation.update({
      where: { id },
      data: {
        status: 'closed',
        operationalStatus: 'CLOSED',
        assignedUserId: null,
        assignedAt: null,
        isAiPaused: true,
        lastStatus: 'Conversa fechada.',
        lastError: null,
      },
      include: this.getConversationInclude(),
    })

    await this.writeIntegrationLog({
      storeId,
      type: 'conversation_closed',
      status: 'success',
      message: 'Conversa fechada no Atendente IA.',
      metadata: { conversationId: id },
    })

    return AiAttendantMapper.toConversationDto(updated)
  }

  private async activateHumanConversation(
    storeId: string,
    id: string,
    userId: string,
    lastStatus: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.aiConversation.updateMany({
        where: {
          id,
          storeId,
          OR: [
            { operationalStatus: 'HUMAN_ACTIVE', assignedUserId: userId },
            {
              operationalStatus: { in: ['AI_ACTIVE', 'WAITING_HUMAN', 'PAUSED'] },
              assignedUserId: null,
            },
          ],
        },
        data: {
          status: 'human_assigned',
          operationalStatus: 'HUMAN_ACTIVE',
          assignedUserId: userId,
          assignedAt: new Date(),
          unreadCount: 0,
          isAiPaused: true,
          lastStatus,
          lastError: null,
        },
      })

      if (changed.count !== 1) {
        const current = await transaction.aiConversation.findFirst({
          where: { id, storeId },
          select: { id: true },
        })
        if (!current) throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
        throw new HttpException('A conversa ja foi assumida por outro atendente.', HttpStatus.CONFLICT)
      }

      const queuedAiMessages = await transaction.aiMessage.findMany({
        where: { conversationId: id, senderType: 'ai', status: 'queued' },
        select: { id: true, metadata: true },
      })
      const cancelledAt = new Date()
      for (const message of queuedAiMessages) {
        const outboundMessageId = readOutboundMessageId(message.metadata)
        if (!outboundMessageId) continue
        const cancelled = await transaction.outboundMessage.updateMany({
          where: { id: outboundMessageId, status: 'PENDING' },
          data: {
            status: 'FAILED',
            failedAt: cancelledAt,
            lastErrorCode: 'conversation_handoff',
            lastErrorMessage: 'Resposta da IA cancelada por handoff humano.',
          },
        })
        if (cancelled.count === 1) {
          await transaction.aiMessage.update({
            where: { id: message.id },
            data: {
              status: 'failed',
              failedAt: cancelledAt,
              errorMessage: 'Resposta da IA cancelada por handoff humano.',
            },
          })
        }
      }

      return transaction.aiConversation.findUniqueOrThrow({
        where: { id },
        include: this.getConversationInclude(),
      })
    })
  }

  private async assertActiveMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId,
        userId,
        active: true,
        user: { status: 'active' },
      },
      select: { id: true },
    })
    if (!membership) {
      throw new HttpException('Usuario sem vinculo ativo com a loja.', HttpStatus.FORBIDDEN)
    }
  }

  private isCloudWhatsappProvider() {
    const provider = this.configService.get<string>('WHATSAPP_PROVIDER')?.trim()
    return provider === 'cloud' || provider === 'whatsapp_cloud'
  }

  // ── Order Drafts CRUD ───────────────────────────────────────────────

  async getOrderDrafts(storeId: string) {
    const drafts = await this.prisma.aiOrderDraft.findMany({
      where: { conversation: { storeId } },
      include: { conversation: true },
      orderBy: { createdAt: 'desc' },
    })

    return drafts.map((d) => AiAttendantMapper.toOrderDraftDto(d))
  }

  async approveOrderDraft(storeId: string, id: string) {
    const draft = await this.prisma.aiOrderDraft.findFirst({
      where: { id, conversation: { storeId } },
    })

    if (!draft) {
      throw new HttpException('Order draft not found.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiOrderDraft.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date() },
    })

    return AiAttendantMapper.toOrderDraftDto(updated)
  }

  async discardOrderDraft(storeId: string, id: string) {
    const draft = await this.prisma.aiOrderDraft.findFirst({
      where: { id, conversation: { storeId } },
    })

    if (!draft) {
      throw new HttpException('Order draft not found.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiOrderDraft.update({
      where: { id },
      data: { status: 'discarded' },
    })

    return AiAttendantMapper.toOrderDraftDto(updated)
  }

  async prepareOrderDraft(storeId: string, id: string) {
    const draft = await this.prisma.aiOrderDraft.findFirst({
      where: { id, conversation: { storeId } },
      include: {
        conversation: {
          include: {
            customer: {
              include: {
                addresses: { orderBy: { updatedAt: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    })

    if (!draft) {
      throw new HttpException('Order draft not found.', HttpStatus.NOT_FOUND)
    }

    const parsedItems = parseOrderDraftItems(draft.parsedItems)
    const itemsForOrder = parsedItems.flatMap((item) => [item, ...(item.addons ?? [])])
    const preparedItems = await Promise.all(
      itemsForOrder.map((item) => this.prepareDraftItem(storeId, item)),
    )
    const unresolvedItems = preparedItems.filter((item) => !item.productId)
    const resolvedItems = preparedItems.filter(
      (item): item is PreparedAiOrderDraftItem => Boolean(item.productId),
    )
    const itemMissingFields = resolvedItems.flatMap((item) => item.missingFields ?? [])
    const resolvedOrderItems = resolvedItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      ...(item.notes ? { notes: item.notes } : {}),
      options: item.options,
    }))
    const customer = draft.conversation.customer
    const address = customer?.addresses[0] ?? null

    return {
      draftId: draft.id,
      conversationId: draft.conversationId,
      customerId: customer?.id ?? draft.customerId,
      customerName: customer?.name ?? draft.conversation.customerName,
      customerPhone: customer?.phone ?? draft.conversation.whatsappNumber,
      addressId: address?.id ?? null,
      channel: 'delivery' as const,
      paymentMethod: 'pix' as const,
      notes: [
        'Pedido preparado a partir de rascunho da IA. Revise itens, endereco, pagamento e observacoes antes de criar.',
        draft.rawText,
      ].join('\n\n'),
      items: resolvedOrderItems,
      unresolvedItems,
      missingFields: [...new Set([...parseStringArray(draft.missingFields), ...itemMissingFields])],
    }
  }

  async markOrderDraftConverted(storeId: string, id: string, orderId: string) {
    const [draft, order] = await Promise.all([
      this.prisma.aiOrderDraft.findFirst({
        where: { id, conversation: { storeId } },
      }),
      this.prisma.order.findFirst({
        where: { id: orderId, storeId },
      }),
    ])

    if (!draft) {
      throw new HttpException('Order draft not found.', HttpStatus.NOT_FOUND)
    }

    if (!order) {
      throw new HttpException('Order not found for this store.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiOrderDraft.update({
      where: { id },
      data: {
        status: 'converted',
        approvedAt: draft.approvedAt ?? new Date(),
        convertedOrderId: order.id,
        metadata: {
          ...(isJsonRecord(draft.metadata) ? draft.metadata : {}),
          convertedOrderNumber: order.number,
          convertedAt: new Date().toISOString(),
        },
      },
    })

    return AiAttendantMapper.toOrderDraftDto(updated)
  }

  private async prepareDraftItem(
    storeId: string,
    item: AiOrderDraftParsedItem,
  ): Promise<PreparedAiOrderDraftItem | UnresolvedAiOrderDraftItem> {
    const product = await this.prisma.product.findFirst({
      where: item.productId
        ? { id: item.productId, storeId, active: true }
        : {
            storeId,
            active: true,
            name: { equals: item.productName, mode: 'insensitive' },
          },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: {
                options: {
                  where: { active: true, available: true, soldOut: false },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    })

    if (!product) {
      return {
        productId: null,
        productName: item.productName,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
        reason: 'Produto nao encontrado no catalogo ativo.',
      }
    }

    const deliveryAvailability = product.availability.find((entry) => entry.channel === 'delivery')

    if (
      !deliveryAvailability ||
      !deliveryAvailability.visible ||
      deliveryAvailability.soldOut ||
      deliveryAvailability.available === false
    ) {
      return {
        productId: null,
        productName: item.productName,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
        reason: !deliveryAvailability
          ? 'Produto sem disponibilidade configurada no canal delivery.'
          : !deliveryAvailability.visible
            ? 'Produto oculto no canal delivery.'
            : deliveryAvailability.soldOut
          ? 'Produto esgotado no canal delivery.'
          : 'Produto indisponivel no canal delivery.',
      }
    }

    const preparedOptionResults = (item.options ?? []).map((option) => ({
      source: option,
      resolved: this.prepareDraftOption(product.optionGroups, option),
    }))
    const preparedOptions = preparedOptionResults
      .map((result) => result.resolved)
      .filter((option): option is PreparedAiOrderDraftItem['options'][number] => option !== null)
    const missingFields = [
      ...preparedOptionResults
        .filter((result) => result.resolved === null)
        .map((result) =>
          `${product.name}: opcao nao encontrada (${result.source.optionName ?? result.source.groupName ?? 'sem nome'})`,
        ),
      ...this.getRequiredOptionMissingFields(product.name, product.optionGroups, preparedOptions),
    ]

    return {
      productId: product.id,
      name: product.name,
      quantity: Math.max(1, item.quantity),
      unitPrice: Number(deliveryAvailability?.priceOverride ?? product.price),
      ...(item.notes ? { notes: item.notes } : {}),
      ...(missingFields.length ? { missingFields } : {}),
      options: preparedOptions,
    }
  }

  private getRequiredOptionMissingFields(
    productName: string,
    optionGroups: Prisma.ProductOptionGroupLinkGetPayload<{
      include: {
        group: {
          include: {
            options: true
          }
        }
      }
    }>[],
    preparedOptions: PreparedAiOrderDraftItem['options'],
  ) {
    return optionGroups.flatMap((link) => {
      if (!link.required || link.minSelections <= 0) {
        return []
      }

      const selectedQuantity = preparedOptions
        .filter((option) => option.groupId === link.group.id)
        .reduce((sum, option) => sum + option.quantity, 0)

      return selectedQuantity >= link.minSelections
        ? []
        : [`${productName}: selecionar ${link.group.name}`]
    })
  }

  private prepareDraftOption(
    optionGroups: Prisma.ProductOptionGroupLinkGetPayload<{
      include: {
        group: {
          include: {
            options: true
          }
        }
      }
    }>[],
    option: AiOrderDraftParsedOption,
  ): PreparedAiOrderDraftItem['options'][number] | null {
    const matchingGroup = optionGroups.find((link) => {
      if (option.groupId && link.groupId === option.groupId) return true
      if (option.groupName && link.group.name.toLowerCase() === option.groupName.toLowerCase()) {
        return true
      }
      return false
    })

    const groupsToSearch = matchingGroup ? [matchingGroup] : optionGroups
    const matchingOption = groupsToSearch
      .flatMap((link) =>
        link.group.options.map((groupOption) => ({
          link,
          groupOption,
        })),
      )
      .find(({ groupOption }) => {
        if (option.optionId && groupOption.id === option.optionId) return true
        if (option.optionName && groupOption.name.toLowerCase() === option.optionName.toLowerCase()) {
          return true
        }
        return false
      })

    if (!matchingOption) {
      return null
    }

    return {
      id: matchingOption.groupOption.id,
      groupId: matchingOption.link.group.id,
      groupName: matchingOption.link.group.name,
      name: matchingOption.groupOption.name,
      quantity: Math.max(1, option.quantity ?? 1),
      price: Number(matchingOption.groupOption.priceDelta),
    }
  }

  private getConversationInclude(): Prisma.AiConversationInclude {
    return {
      messages: { orderBy: { createdAt: 'asc' } },
      orderDrafts: { orderBy: { createdAt: 'desc' } },
      customer: {
        include: {
          addresses: { orderBy: { updatedAt: 'desc' }, take: 3 },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { items: true },
          },
        },
      },
    }
  }

  private async writeIntegrationLog(input: {
    storeId: string
    sessionId?: string | null
    type: WhatsappIntegrationLogType
    status: IntegrationLogStatus
    message: string
    metadata?: unknown
  }) {
    const metadata = this.toJsonValue(input.metadata)

    await this.prisma.whatsappIntegrationLog.create({
      data: {
        storeId: input.storeId,
        sessionId: input.sessionId ?? null,
        type: input.type,
        status: input.status,
        message: input.message,
        metadata,
      },
    })
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined
    if (value === null) return undefined

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    if (Array.isArray(value)) {
      const arrayValue: Prisma.InputJsonValue[] = []
      for (const item of value) {
        const jsonItem = this.toJsonValue(item)
        if (jsonItem !== undefined) {
          arrayValue.push(jsonItem)
        }
      }
      return arrayValue
    }

    if (typeof value === 'object') {
      const objectValue: Record<string, Prisma.InputJsonValue> = {}
      for (const [key, item] of Object.entries(value)) {
        const jsonItem = this.toJsonValue(item)
        if (jsonItem !== undefined) {
          objectValue[key] = jsonItem
        }
      }
      return objectValue
    }

    return String(value)
  }

  private getSafeErrorMessage(error: unknown, fallback: string) {
    if (error instanceof HttpException) {
      const response = error.getResponse()
      if (typeof response === 'string') return response
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof response.message === 'string'
      ) {
        return response.message
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return fallback
  }

  private maskPhone(phone: string) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length <= 4) return '****'
    return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`
  }

  private normalizeSingleWhatsappNumber(phone: string) {
    if (/[,;\n\r]/.test(phone)) {
      throw new HttpException(
        'Informe apenas um numero por envio de teste.',
        HttpStatus.BAD_REQUEST,
      )
    }

    const normalized = phone.replace(/\D/g, '')

    if (normalized.length < 8 || normalized.length > 15) {
      throw new HttpException(
        'Numero de WhatsApp invalido para envio de teste.',
        HttpStatus.BAD_REQUEST,
      )
    }

    return normalized
  }
}

function readOutboundMessageId(value: Prisma.JsonValue) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    typeof value.outboundMessageId === 'string'
    ? value.outboundMessageId
    : null
}

function parseOrderDraftItems(value: Prisma.JsonValue): AiOrderDraftParsedItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(parseOrderDraftItem)
    .filter((item): item is AiOrderDraftParsedItem => item !== null)
}

function parseOrderDraftItem(value: Prisma.JsonValue): AiOrderDraftParsedItem | null {
  if (!isJsonRecord(value) || typeof value.productName !== 'string') {
    return null
  }

  const quantity =
    typeof value.quantity === 'number' && Number.isFinite(value.quantity)
      ? Math.max(1, value.quantity)
      : 1
  const productId = typeof value.productId === 'string' && value.productId.trim()
    ? value.productId
    : undefined
  const notes = typeof value.notes === 'string' && value.notes.trim() ? value.notes : undefined
  const price = typeof value.price === 'number' && Number.isFinite(value.price)
    ? value.price
    : undefined
  const options = Array.isArray(value.options)
    ? value.options
        .map(parseOrderDraftOption)
        .filter((option): option is AiOrderDraftParsedOption => option !== null)
    : undefined
  const addons = Array.isArray(value.addons)
    ? value.addons
        .map(parseOrderDraftItem)
        .filter((addon): addon is AiOrderDraftParsedItem => addon !== null)
    : undefined

  return {
    ...(productId ? { productId } : {}),
    productName: value.productName,
    quantity,
    ...(options && options.length ? { options } : {}),
    ...(addons && addons.length ? { addons } : {}),
    ...(notes ? { notes } : {}),
    ...(price !== undefined ? { price } : {}),
  }
}

function parseOrderDraftOption(value: Prisma.JsonValue): AiOrderDraftParsedOption | null {
  if (!isJsonRecord(value)) {
    return null
  }

  const groupId = typeof value.groupId === 'string' && value.groupId.trim()
    ? value.groupId
    : undefined
  const groupName = typeof value.groupName === 'string' && value.groupName.trim()
    ? value.groupName
    : undefined
  const optionId = typeof value.optionId === 'string' && value.optionId.trim()
    ? value.optionId
    : undefined
  const optionName = typeof value.optionName === 'string' && value.optionName.trim()
    ? value.optionName
    : undefined

  if (!groupId && !groupName && !optionId && !optionName) {
    return null
  }

  const quantity =
    typeof value.quantity === 'number' && Number.isFinite(value.quantity)
      ? Math.max(1, value.quantity)
      : undefined
  const price = typeof value.price === 'number' && Number.isFinite(value.price)
    ? value.price
    : undefined

  return {
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName } : {}),
    ...(optionId ? { optionId } : {}),
    ...(optionName ? { optionName } : {}),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(price !== undefined ? { price } : {}),
  }
}

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function isJsonRecord(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
