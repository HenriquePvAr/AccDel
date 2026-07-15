import { Injectable } from '@nestjs/common'
import type { OutboundMessageStatus } from '@prisma/client'

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
  }) {
    const current = await this.prisma.outboundMessage.findUnique({
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

    await this.prisma.outboundMessage.update({ where: { id: current.id }, data })
    await this.updateConversationMessage(current.id, input.status, input.occurredAt, input.errorMessage)
    return { matched: true, updated: true }
  }

  private async updateConversationMessage(
    outboundMessageId: string,
    status: Extract<OutboundMessageStatus, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>,
    occurredAt: Date,
    errorMessage?: string | null,
  ) {
    await this.prisma.aiMessage.updateMany({
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

function sanitizeError(value?: string | null) {
  return value?.replace(/[\r\n\t]+/g, ' ').slice(0, 240) ?? null
}
