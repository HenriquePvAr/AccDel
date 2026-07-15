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

    let receipt
    try {
      receipt = await this.prisma.inboundEvent.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 'duplicate' as const
      }
      throw error
    }

    if (event.kind === 'status') {
      await this.statuses.apply({
        accountId: account.id,
        externalMessageId: event.externalMessageId,
        status: event.status,
        occurredAt: event.occurredAt,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
      })
      await this.prisma.inboundEvent.update({
        where: { id: receipt.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      })
      return 'accepted' as const
    }

    await this.persistInboundMessage(receipt.id, account.id, account.storeId, account.legacySessionId, event)
    return 'accepted' as const
  }

  private async persistInboundMessage(
    receiptId: string,
    accountId: string,
    storeId: string,
    compatibilitySessionId: string | null,
    event: NormalizedInboundMessage,
  ) {
    if (!compatibilitySessionId) {
      throw new Error('Conta de mensageria sem sessao de compatibilidade.')
    }

    const existingIdentity = await this.prisma.customerChannelIdentity.findUnique({
      where: { accountId_providerUserId: { accountId, providerUserId: event.sender } },
    })
    const identity = await this.prisma.customerChannelIdentity.upsert({
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
    const customerId = identity.customerId ?? (await this.resolveCustomer(storeId, event))
    if (!identity.customerId) {
      await this.prisma.customerChannelIdentity.update({
        where: { id: identity.id },
        data: { customerId },
      })
    }

    const existingConversation = await this.prisma.aiConversation.findUnique({
      where: {
        messagingAccountId_whatsappNumber: {
          messagingAccountId: accountId,
          whatsappNumber: event.sender,
        },
      },
    })
    const conversation = existingConversation
      ? await this.prisma.aiConversation.update({
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
      : await this.prisma.aiConversation.create({
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

    await this.prisma.$transaction([
      this.prisma.aiMessage.create({
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
      }),
      this.prisma.inboundEvent.update({
        where: { id: receiptId },
        data: { conversationId: conversation.id },
      }),
    ])
  }

  private async resolveCustomer(storeId: string, event: NormalizedInboundMessage) {
    const suffix = event.sender.slice(-8)
    const candidates = await this.prisma.customer.findMany({
      where: { storeId, phone: { contains: suffix } },
      select: { id: true, phone: true },
      take: 20,
    })
    const matching = candidates.find((candidate) => phonesMatch(candidate.phone, event.sender))
    if (matching) return matching.id

    const customer = await this.prisma.customer.create({
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

function phonesMatch(left: string, right: string) {
  const leftDigits = left.replace(/\D/g, '')
  const rightDigits = right.replace(/\D/g, '')
  return leftDigits === rightDigits || leftDigits.slice(-8) === rightDigits.slice(-8)
}

function latestDate(current: Date | null | undefined, candidate: Date) {
  return current && current > candidate ? current : candidate
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
