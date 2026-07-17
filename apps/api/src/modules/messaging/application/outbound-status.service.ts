import { Injectable } from '@nestjs/common'
import type { OutboundMessageStatus, Prisma } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

const statusRank: Record<OutboundMessageStatus, number> = {
  PENDING: 0,
  SENDING: 0,
  SENT: 1,
  FAILED: 1,
  DELIVERED: 2,
  READ: 3,
}

@Injectable()
export class OutboundStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(input: {
    accountId: string
    externalMessageId: string
    status: Extract<OutboundMessageStatus, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>
    occurredAt: Date
    errorCode?: string | null
    errorMessage?: string | null
  }, database: Prisma.TransactionClient | PrismaService = this.prisma) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await database.outboundMessage.findUnique({
        where: {
          accountId_externalMessageId: {
            accountId: input.accountId,
            externalMessageId: input.externalMessageId,
          },
        },
      })
      if (!current) return { matched: false, updated: false }

      const latestKnownAt =
        current.readAt ?? current.deliveredAt ?? current.failedAt ?? current.sentAt ?? current.updatedAt
      if (
        statusRank[input.status] < statusRank[current.status] ||
        (statusRank[input.status] === statusRank[current.status] && input.occurredAt < latestKnownAt)
      ) {
        return { matched: true, updated: false }
      }

      const data = {
        status: input.status,
        ...(input.status === 'SENT' ? { sentAt: input.occurredAt } : {}),
        ...(input.status === 'DELIVERED' ? { deliveredAt: input.occurredAt } : {}),
        ...(input.status === 'READ' ? { readAt: input.occurredAt } : {}),
        ...(input.status === 'FAILED'
          ? {
              failedAt: input.occurredAt,
              lastErrorCode: input.errorCode?.slice(0, 80) ?? 'provider_failed',
              lastErrorMessage: sanitizeError(input.errorMessage),
            }
          : {}),
      }

      const updated = await database.outboundMessage.updateMany({
        where: { id: current.id, status: current.status, updatedAt: current.updatedAt },
        data,
      })
      if (updated.count !== 1) continue
      await this.updateConversationMessage(database, current.id, input.status, input.occurredAt, input.errorMessage)
      return { matched: true, updated: true }
    }
    return { matched: true, updated: false }
  }

  async reconcileStored(accountId: string, externalMessageId: string) {
    const events = await this.prisma.inboundEvent.findMany({
      where: {
        accountId,
        eventType: 'status',
        normalizedPayload: { path: ['externalMessageId'], equals: externalMessageId },
      },
      orderBy: { receivedAt: 'asc' },
      select: { normalizedPayload: true },
    })
    for (const event of events) {
      const normalized = asStoredStatus(event.normalizedPayload)
      if (normalized) await this.apply({ accountId, ...normalized })
    }
  }

  private async updateConversationMessage(
    database: Prisma.TransactionClient | PrismaService,
    outboundMessageId: string,
    status: Extract<OutboundMessageStatus, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>,
    occurredAt: Date,
    errorMessage?: string | null,
  ) {
    await database.aiMessage.updateMany({
      where: { metadata: { equals: { outboundMessageId } } },
      data: {
        status: status.toLowerCase() as 'sent' | 'delivered' | 'read' | 'failed',
        ...(status === 'SENT' ? { sentAt: occurredAt } : {}),
        ...(status === 'FAILED'
          ? { failedAt: occurredAt, errorMessage: sanitizeError(errorMessage) }
          : {}),
      },
    })
  }
}

function asStoredStatus(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const occurredAt = typeof record.occurredAt === 'string' ? new Date(record.occurredAt) : null
  if (
    typeof record.externalMessageId !== 'string' ||
    !['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(String(record.status)) ||
    !occurredAt ||
    Number.isNaN(occurredAt.getTime())
  ) return null
  return {
    externalMessageId: record.externalMessageId,
    status: record.status as Extract<OutboundMessageStatus, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>,
    occurredAt,
    errorCode: typeof record.errorCode === 'string' ? record.errorCode : null,
    errorMessage: typeof record.errorMessage === 'string' ? record.errorMessage : null,
  }
}

function sanitizeError(value?: string | null) {
  return value?.replace(/[\r\n\t]+/g, ' ').slice(0, 240) ?? null
}
