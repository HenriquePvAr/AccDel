import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'

import { PrismaService } from '@/shared/prisma/prisma.service'

import type {
  NormalizedInboundMessage,
  NormalizedWhatsappEvent,
} from '../domain/normalized-event'
import { MessagingAccountService } from './messaging-account.service'
import { OutboundStatusService } from './outbound-status.service'

@Injectable()
export class InboundEventIngressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MessagingAccountService,
    private readonly statuses: OutboundStatusService,
  ) {}

  async accept(events: NormalizedWhatsappEvent[]) {
    let accepted = 0
    let duplicates = 0

    for (const event of events) {
      const result = await this.acceptOne(event)
      if (result === 'accepted') accepted += 1
      if (result === 'duplicate') duplicates += 1
    }

    return { accepted, duplicates }
  }

  private async acceptOne(event: NormalizedWhatsappEvent) {
    const account = await this.accounts.resolveCloudAccount({
      phoneNumberId: event.phoneNumberId,
      businessAccountId: event.businessAccountId,
    })
    const correlationId = randomUUID()
    const normalizedPayload = toJson(event)

    try {
      await this.prisma.$transaction(async (transaction) => {
        const receipt = await transaction.inboundEvent.create({
          data: {
            storeId: account.storeId,
            accountId: account.id,
            externalEventId: event.externalEventId,
            eventType: event.kind,
            payloadHash: createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex'),
            normalizedPayload,
            correlationId,
            retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
          },
        })

        if (event.kind === 'status') {
          await this.statuses.apply({
            accountId: account.id,
            externalMessageId: event.externalMessageId,
            status: event.status,
            occurredAt: event.occurredAt,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
          }, transaction)
          await transaction.inboundEvent.update({
            where: { id: receipt.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          })
          return
        }

        await this.persistInboundMessage(
          transaction,
          receipt.id,
          account.id,
          account.storeId,
          account.legacySessionId,
          event,
        )
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.prisma.inboundEvent.findUnique({
          where: {
            accountId_externalEventId: {
              accountId: account.id,
              externalEventId: event.externalEventId,
            },
          },
          select: { id: true },
        })
        if (duplicate) return 'duplicate' as const
      }
      throw error
    }
    return 'accepted' as const
  }

  private async persistInboundMessage(
    transaction: Prisma.TransactionClient,
    receiptId: string,
    accountId: string,
    storeId: string,
    compatibilitySessionId: string | null,
    event: NormalizedInboundMessage,
  ) {
    if (!compatibilitySessionId) {
      throw new Error('Conta de mensageria sem sessao de compatibilidade.')
    }

    const existingIdentity = await transaction.customerChannelIdentity.findUnique({
      where: { accountId_providerUserId: { accountId, providerUserId: event.sender } },
    })
    const identity = await transaction.customerChannelIdentity.upsert({
      where: { accountId_providerUserId: { accountId, providerUserId: event.sender } },
      create: {
        storeId,
        accountId,
        providerUserId: event.sender,
        displayName: event.contactName,
        lastInboundAt: latestDate(existingIdentity?.lastInboundAt, event.occurredAt),
      },
      update: {
        displayName: event.contactName ?? undefined,
        lastInboundAt: latestDate(existingIdentity?.lastInboundAt, event.occurredAt),
      },
    })
    const customerId = identity.customerId ?? (await this.resolveCustomer(transaction, storeId, event))
    if (!identity.customerId) {
      await transaction.customerChannelIdentity.update({
        where: { id: identity.id },
        data: { customerId },
      })
    }

    const existingConversation = await transaction.aiConversation.findUnique({
      where: {
        messagingAccountId_whatsappNumber: {
          messagingAccountId: accountId,
          whatsappNumber: event.sender,
        },
      },
    })
    const conversation = existingConversation
      ? await transaction.aiConversation.update({
          where: { id: existingConversation.id },
          data: {
            customerId,
            channelIdentityId: identity.id,
            customerName: event.contactName ?? undefined,
            lastInboundAt: latestDate(existingConversation.lastInboundAt, event.occurredAt),
            lastMessageAt: latestDate(existingConversation.lastMessageAt, event.occurredAt),
            unreadCount: { increment: 1 },
            ...(existingConversation.operationalStatus === 'CLOSED'
              ? { operationalStatus: 'AI_ACTIVE', status: 'open' }
              : {}),
          },
        })
      : await transaction.aiConversation.create({
          data: {
            storeId,
            whatsappSessionId: compatibilitySessionId,
            messagingAccountId: accountId,
            channelIdentityId: identity.id,
            customerId,
            whatsappNumber: event.sender,
            customerName: event.contactName,
            status: 'ai_active',
            operationalStatus: 'AI_ACTIVE',
            lastInboundAt: event.occurredAt,
            lastMessageAt: event.occurredAt,
            unreadCount: 1,
          },
        })

    await transaction.aiMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        senderType: 'customer',
        body: event.body ?? `[${event.contentType.toLowerCase()}]`,
        status: 'received',
        rawPayload: event.metadata as Prisma.InputJsonValue,
        metadata: {
          externalMessageId: event.externalEventId,
          contentType: event.contentType,
          correlationId: receiptId,
        },
        createdAt: event.occurredAt,
      },
    })
    await transaction.inboundEvent.update({
      where: { id: receiptId },
      data: { conversationId: conversation.id },
    })
  }

  private async resolveCustomer(
    transaction: Prisma.TransactionClient,
    storeId: string,
    event: NormalizedInboundMessage,
  ) {
    const suffix = event.sender.slice(-8)
    const candidates = await transaction.customer.findMany({
      where: { storeId, phone: { contains: suffix } },
      select: { id: true, phone: true },
      take: 20,
    })
    const matching = candidates.find((candidate) => phonesMatch(candidate.phone, event.sender))
    if (matching) return matching.id

    const customer = await transaction.customer.create({
      data: {
        storeId,
        name: event.contactName ?? `Cliente WhatsApp ${event.sender.slice(-4)}`,
        phone: event.sender,
        tags: ['WhatsApp'],
      },
    })
    return customer.id
  }
}

export function phonesMatch(left: string, right: string) {
  const leftDigits = left.replace(/\D/g, '')
  const rightDigits = right.replace(/\D/g, '')
  return leftDigits === rightDigits
}

function latestDate(current: Date | null | undefined, candidate: Date) {
  return current && current > candidate ? current : candidate
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
