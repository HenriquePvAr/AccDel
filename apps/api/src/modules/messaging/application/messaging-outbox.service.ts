import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, type MessagingContentType } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

import { ConversationWindowService } from './conversation-window.service'
import { normalizeWhatsappRecipient } from './messaging-sandbox-policy.service'

export interface EnqueueMessageInput {
  storeId: string
  accountId: string
  conversationId?: string
  orderId?: string
  notificationId?: string
  recipient: string
  contentType: MessagingContentType
  payload: Record<string, unknown>
  idempotencyKey: string
  replyToExternalId?: string
  senderType?: 'ai' | 'human' | 'system'
}

@Injectable()
export class MessagingOutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly window: ConversationWindowService,
  ) {}

  async enqueueText(input: Omit<EnqueueMessageInput, 'contentType' | 'payload'> & { body: string }) {
    const body = input.body.trim()
    if (!body) throw new NotFoundException('Mensagem vazia.')

    if (input.conversationId) {
      const conversation = await this.prisma.aiConversation.findFirst({
        where: { id: input.conversationId, storeId: input.storeId },
        select: { lastInboundAt: true },
      })
      if (!conversation) throw new NotFoundException('Conversa nao encontrada.')
      this.window.assertFreeFormAllowed(conversation)
    }

    return this.enqueue({
      ...input,
      contentType: 'TEXT',
      payload: { body },
    })
  }

  enqueueTemplate(
    input: Omit<EnqueueMessageInput, 'contentType' | 'payload'> & {
      templateName: string
      languageCode: string
      components?: Record<string, unknown>[]
    },
  ) {
    return this.enqueue({
      ...input,
      contentType: 'TEMPLATE',
      payload: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(input.components?.length ? { components: input.components } : {}),
      },
    })
  }

  async enqueue(input: EnqueueMessageInput) {
    const retentionUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000)
    const recipient = normalizeWhatsappRecipient(input.recipient)
    if (!recipient) throw new BadRequestException('Destinatario WhatsApp invalido.')
    const maxAttempts = this.config.get<number>('WHATSAPP_OUTBOX_MAX_ATTEMPTS') ?? 5

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const account = await transaction.messagingAccount.findFirst({
          where: { id: input.accountId, storeId: input.storeId, enabled: true },
        })
        if (!account) throw new NotFoundException('Conta de mensageria nao encontrada para a loja.')

        if (input.conversationId) {
          const conversation = await transaction.aiConversation.findFirst({
            where: { id: input.conversationId, storeId: input.storeId },
            select: { messagingAccountId: true, whatsappSessionId: true },
          })
          const accountMatches = account.provider === 'whatsapp_cloud'
            ? conversation?.messagingAccountId === account.id
            : conversation?.whatsappSessionId === account.legacySessionId
          if (!conversation || !accountMatches) {
            throw new NotFoundException('Conversa nao pertence a conta de mensageria informada.')
          }
        }
        if (input.orderId) {
          const order = await transaction.order.findFirst({
            where: { id: input.orderId, storeId: input.storeId },
            select: { id: true },
          })
          if (!order) throw new NotFoundException('Pedido nao pertence a loja informada.')
        }

        const outbound = await transaction.outboundMessage.create({
          data: {
            storeId: input.storeId,
            accountId: input.accountId,
            conversationId: input.conversationId,
            orderId: input.orderId,
            notificationId: input.notificationId,
            recipient,
            contentType: input.contentType,
            payload: input.payload as Prisma.InputJsonValue,
            idempotencyKey: input.idempotencyKey,
            replyToExternalId: input.replyToExternalId,
            maxAttempts,
            retentionUntil,
          },
        })

        if (input.conversationId && input.contentType === 'TEXT') {
          await transaction.aiMessage.create({
            data: {
              conversationId: input.conversationId,
              direction: 'outbound',
              senderType: input.senderType ?? 'system',
              body: String(input.payload.body ?? ''),
              status: 'queued',
              metadata: { outboundMessageId: outbound.id },
            },
          })
        }

        return outbound
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.outboundMessage.findUnique({
          where: {
            storeId_idempotencyKey: {
              storeId: input.storeId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        })
        if (existing && !sameOutboundRequest(existing, { ...input, recipient })) {
          throw new ConflictException('A chave de idempotencia foi reutilizada com outra mensagem.')
        }
        if (existing) return existing
      }
      throw error
    }
  }
}

function sameOutboundRequest(
  existing: {
    accountId: string
    conversationId: string | null
    orderId: string | null
    notificationId: string | null
    recipient: string
    contentType: MessagingContentType
    payload: Prisma.JsonValue
    replyToExternalId: string | null
  },
  input: EnqueueMessageInput & { recipient: string },
) {
  return existing.accountId === input.accountId &&
    existing.conversationId === (input.conversationId ?? null) &&
    existing.orderId === (input.orderId ?? null) &&
    existing.notificationId === (input.notificationId ?? null) &&
    existing.recipient === input.recipient &&
    existing.contentType === input.contentType &&
    existing.replyToExternalId === (input.replyToExternalId ?? null) &&
    stableJson(existing.payload) === stableJson(input.payload)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}
