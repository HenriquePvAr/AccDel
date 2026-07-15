import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, type MessagingContentType } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

import { ConversationWindowService } from './conversation-window.service'

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
    const recipient = input.recipient.replace(/\D/g, '')
    const maxAttempts = this.config.get<number>('WHATSAPP_OUTBOX_MAX_ATTEMPTS') ?? 5

    try {
      return await this.prisma.$transaction(async (transaction) => {
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
        if (existing) return existing
      }
      throw error
    }
  }
}
