import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma/prisma.service'
import { WhatsappProviderFactory } from './whatsapp-provider.factory'
import { AiProviderFactory } from './ai-provider.factory'
import { AiAttendantMapper } from './ai-attendant.mapper'
import {
  UpdateAiAttendantSettingsPayload,
  CreateKnowledgeEntryPayload,
  UpdateKnowledgeEntryPayload,
  WhatsappWebhookPayload,
} from '../../contracts/ai-attendant.contract'
import {
  WhatsappSessionStatus,
  WhatsappMessageStatus,
  WhatsappMessageSenderType,
} from '@prisma/client'

@Injectable()
export class AiAttendantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappFactory: WhatsappProviderFactory,
    private readonly aiFactory: AiProviderFactory,
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
      this.prisma.whatsappSession.findFirst({ where: { storeId } }),
      this.prisma.aiConversation.count({
        where: { storeId, createdAt: { gte: today } },
      }),
      this.prisma.whatsappMessage.count({
        where: { storeId, createdAt: { gte: today }, direction: 'outbound', senderType: 'ai' },
      }),
      this.prisma.aiConversation.count({
        where: { storeId, status: 'waiting_human' },
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

  // ── Settings ────────────────────────────────────────────────────────

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
          minDelaySeconds: 8,
          maxDelaySeconds: 25,
          messageGroupingSeconds: 6,
          answerOnlyDuringBusinessHours: true,
          transferOnLowConfidence: true,
          transferOnComplaint: true,
          transferOnCancellation: true,
          tone: 'friendly',
          useEmojis: true,
          callCustomerByName: true,
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
      orderBy: { createdAt: 'desc' },
    })
    return entries.map((e) => AiAttendantMapper.toKnowledgeDto(e))
  }

  async createKnowledgeEntry(storeId: string, payload: CreateKnowledgeEntryPayload) {
    const entry = await this.prisma.aiKnowledgeEntry.create({
      data: {
        storeId,
        ...payload,
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
      data: payload,
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

  async testReply(storeId: string, userMessage: string) {
    const aiProvider = this.aiFactory.getProvider()
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        products: { where: { active: true } },
        categories: true,
      },
    })

    if (!store) {
      throw new HttpException('Store not found.', HttpStatus.NOT_FOUND)
    }

    // Build mock contexts using live DB data as required!
    const catalogContext = store.products
      .map((p) => `- ${p.name}: R$ ${Number(p.price).toFixed(2)} (${p.description || ''})`)
      .join('\n')

    const settings = await this.getOrCreateSettings(storeId)
    const settingsContext = `Tone: ${settings.tone}, Emojis: ${settings.useEmojis}`

    const knowledgeList = await this.prisma.aiKnowledgeEntry.findMany({
      where: { storeId, isActive: true },
    })
    const knowledgeContext = knowledgeList
      .map((k) => `[${k.type}] ${k.title}: ${k.content}`)
      .join('\n')

    const result = await aiProvider.generateReply({
      message: userMessage,
      conversationHistory: [],
      storeName: store.name,
      catalogContext,
      settingsContext,
      knowledgeEntriesContext: knowledgeContext,
    })

    return result
  }

  // ── WhatsApp Session Lifecycle ──────────────────────────────────────

  async getSession(storeId: string) {
    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })
    return AiAttendantMapper.toSessionDto(session)
  }

  async startSession(storeId: string) {
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
        data: { status: 'connecting', lastError: null },
      })
    }

    const result = await provider.startSession(storeId, sessionName)

    await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        status: result.status as WhatsappSessionStatus,
        lastError: result.message || null,
      },
    })

    return result
  }

  async getQrCode(storeId: string) {
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

    return result
  }

  async getSessionStatus(storeId: string) {
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

    return result
  }

  async disconnectSession(storeId: string) {
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

    return { success: true }
  }

  async restartSession(storeId: string) {
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

    return result
  }

  // ── Webhook message receiver ────────────────────────────────────────

  async handleIncomingWebhook(payload: WhatsappWebhookPayload) {
    const provider = this.whatsappFactory.getProvider()
    const norm = await provider.handleWebhook(payload)

    if (!norm.sessionId) return { success: false, reason: 'No session specified' }

    // Locate session inside store
    const session = await this.prisma.whatsappSession.findFirst({
      where: { sessionName: norm.sessionId },
    })

    if (!session) return { success: false, reason: 'Session not found locally' }
    if (!norm.from || !norm.body) return { success: false, reason: 'Empty from or body' }

    const storeId = session.storeId
    const cleanNumber = norm.from.replace(/\D/g, '')

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
          status: 'open',
          lastMessageAt: new Date(),
        },
      })
    } else {
      conversation = await this.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          status: conversation.status === 'closed' ? 'open' : conversation.status,
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

    // Process AI pipeline asynchronously if active
    const settings = await this.getOrCreateSettings(storeId)

    if (settings.isEnabled && settings.mode !== 'off' && conversation.status !== 'human_assigned') {
      this.triggerAiPipeline(storeId, conversation.id, norm.body, cleanNumber, session.sessionName)
    } else {
      // Mark as waiting human if AI is off/hybrid but assigned user is not present
      if (conversation.status !== 'human_assigned') {
        await this.prisma.aiConversation.update({
          where: { id: conversation.id },
          data: { status: 'waiting_human' },
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
      if (classification.intent === 'human_request') shouldTransfer = true

      if (shouldTransfer) {
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: { status: 'waiting_human' },
        })

        if (settings.humanHandoffMessage) {
          await this.sendDirectReply(storeId, sessionName, conversationId, cleanNumber, settings.humanHandoffMessage, 'system')
        }
        return
      }

      // 2. Query DB Context
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        include: {
          products: { where: { active: true } },
          categories: true,
        },
      })

      const catalogContext = store?.products
        .map((p) => `- ${p.name}: R$ ${Number(p.price).toFixed(2)} (${p.description || ''})`)
        .join('\n') || ''

      const knowledgeList = await this.prisma.aiKnowledgeEntry.findMany({
        where: { storeId, isActive: true },
      })
      const knowledgeContext = knowledgeList
        .map((k) => `[${k.type}] ${k.title}: ${k.content}`)
        .join('\n')

      const settingsContext = `Tone: ${settings.tone}, Emojis: ${settings.useEmojis}`

      // Fetch history
      const history = await this.prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 12,
      })

      const formattedHistory = history.map((h) => ({
        role: h.senderType as 'customer' | 'ai' | 'human' | 'system',
        content: h.body,
      }))

      // 3. Generate response via Adapter
      const aiResult = await aiProvider.generateReply({
        message: messageBody,
        conversationHistory: formattedHistory,
        storeName: store?.name || 'Store',
        catalogContext,
        settingsContext,
        knowledgeEntriesContext: knowledgeContext,
      })

      // Transfer if confidence low
      if (settings.transferOnLowConfidence && aiResult.confidence < 0.6) {
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: { status: 'waiting_human' },
        })
        if (settings.humanHandoffMessage) {
          await this.sendDirectReply(storeId, sessionName, conversationId, cleanNumber, settings.humanHandoffMessage, 'system')
        }
        return
      }

      // Handle Sugestão mode: does not send automatically
      if (settings.mode === 'suggestion') {
        await this.prisma.aiMessage.create({
          data: {
            conversationId,
            direction: 'outbound',
            senderType: 'ai',
            body: aiResult.reply,
            status: 'queued', // waiting for human approval
          },
        })
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: { status: 'waiting_ai' },
        })
        return
      }

      // Simulate humanized delay
      const delayMs =
        Math.floor(
          Math.random() * (settings.maxDelaySeconds - settings.minDelaySeconds + 1) +
            settings.minDelaySeconds,
        ) * 1000

      setTimeout(async () => {
        // Double check conversation status before dispatching
        const currentConv = await this.prisma.aiConversation.findUnique({
          where: { id: conversationId },
        })

        if (!currentConv || currentConv.status === 'human_assigned') {
          // Human took over in the meantime, cancel automated message dispatch
          return
        }

        await this.sendDirectReply(storeId, sessionName, conversationId, cleanNumber, aiResult.reply, 'ai')
      }, delayMs)
    } catch (error) {
      // Gracefully handle to prevent webhook crashes, record last error to session
      const err = error as Error
      const session = await this.prisma.whatsappSession.findFirst({
        where: { storeId },
      })
      if (session) {
        await this.prisma.whatsappSession.update({
          where: { id: session.id },
          data: { lastError: `AI Pipeline error: ${err.message}` },
        })
      }
    }
  }

  private async sendDirectReply(
    storeId: string,
    sessionName: string,
    conversationId: string,
    to: string,
    messageText: string,
    senderType: WhatsappMessageSenderType,
  ) {
    const provider = this.whatsappFactory.getProvider()
    const sendResult = await provider.sendMessage(sessionName, to, messageText)

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
          status: sendResult.status as WhatsappMessageStatus,
        },
      })
    }

    await this.prisma.aiMessage.create({
      data: {
        conversationId,
        direction: 'outbound',
        senderType,
        body: messageText,
        status: sendResult.status as WhatsappMessageStatus,
      },
    })

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastAiResponseAt: senderType === 'ai' ? new Date() : undefined,
      },
    })
  }

  // ── Conversation Manual Operations ──────────────────────────────────

  async getConversations(storeId: string) {
    const conversations = await this.prisma.aiConversation.findMany({
      where: { storeId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        orderDrafts: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    return conversations.map((c) => AiAttendantMapper.toConversationDto(c))
  }

  async getConversationDetail(storeId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        orderDrafts: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    return AiAttendantMapper.toConversationDto(conversation)
  }

  async assignConversation(storeId: string, id: string, userId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    const updated = await this.prisma.aiConversation.update({
      where: { id },
      data: {
        status: 'human_assigned',
        assignedUserId: userId,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        orderDrafts: { orderBy: { createdAt: 'desc' } },
      },
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
        assignedUserId: null,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        orderDrafts: { orderBy: { createdAt: 'desc' } },
      },
    })

    return AiAttendantMapper.toConversationDto(updated)
  }

  async sendManualMessage(storeId: string, id: string, body: string, userId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, storeId },
    })

    if (!conversation) {
      throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND)
    }

    const session = await this.prisma.whatsappSession.findFirst({
      where: { storeId },
    })

    if (!session || session.status !== 'connected') {
      throw new HttpException(
        'Cannot send message: WhatsApp is not connected.',
        HttpStatus.BAD_REQUEST,
      )
    }

    // Force human assign if they send manual message
    await this.prisma.aiConversation.update({
      where: { id },
      data: { status: 'human_assigned', assignedUserId: userId },
    })

    await this.sendDirectReply(
      storeId,
      session.sessionName,
      id,
      conversation.whatsappNumber,
      body,
      'human',
    )

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
        assignedUserId: null,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        orderDrafts: { orderBy: { createdAt: 'desc' } },
      },
    })

    return AiAttendantMapper.toConversationDto(updated)
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
      data: { status: 'approved' },
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
}
