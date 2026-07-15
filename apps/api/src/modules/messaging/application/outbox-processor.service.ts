import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { OutboundMessage } from '@prisma/client'
import { randomUUID } from 'node:crypto'

import { PrismaService } from '@/shared/prisma/prisma.service'

import { MessagingProviderError } from '../domain/messaging-provider'
import { MessagingSandboxPolicy } from './messaging-sandbox-policy.service'
import { MessagingProviderRouter } from './messaging-provider-router.service'
import { OutboundStatusService } from './outbound-status.service'

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name)
  private readonly workerId = randomUUID()
  private interval?: NodeJS.Timeout
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly providers: MessagingProviderRouter,
    private readonly sandbox: MessagingSandboxPolicy,
    private readonly statuses: OutboundStatusService,
  ) {}

  onModuleInit() {
    if (!this.config.get<string>('WHATSAPP_PROVIDER')?.trim()) return
    const intervalMs = this.config.get<number>('WHATSAPP_OUTBOX_POLL_INTERVAL_MS') ?? 1_000
    this.interval = setInterval(() => void this.tick(), intervalMs)
    this.interval.unref()
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval)
  }

  async tick() {
    if (this.running) return
    this.running = true
    try {
      for (let index = 0; index < 10; index += 1) {
        const message = await this.claimNext()
        if (!message) break
        await this.deliver(message)
      }
    } finally {
      this.running = false
    }
  }

  private async claimNext() {
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH candidate AS (
        SELECT message.id
        FROM outbound_messages AS message
        WHERE message.available_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          AND (
            message.status = 'PENDING'::"OutboundMessageStatus"
            OR (
              message.status = 'SENDING'::"OutboundMessageStatus"
              AND message.locked_at < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
            )
          )
          AND (
            message.conversation_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM outbound_messages AS earlier
              WHERE earlier.conversation_id = message.conversation_id
                AND earlier.status IN (
                  'PENDING'::"OutboundMessageStatus",
                  'SENDING'::"OutboundMessageStatus"
                )
                AND (
                  earlier.created_at < message.created_at
                  OR (earlier.created_at = message.created_at AND earlier.id < message.id)
                )
            )
          )
        ORDER BY message.available_at ASC, message.created_at ASC, message.id ASC
        FOR UPDATE OF message SKIP LOCKED
        LIMIT 1
      )
      UPDATE outbound_messages AS message
      SET status = 'SENDING'::"OutboundMessageStatus",
          locked_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
          locked_by = ${this.workerId},
          last_attempt_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
          attempts = message.attempts + 1,
          updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FROM candidate
      WHERE message.id = candidate.id
      RETURNING message.id AS "id"
    `
    const id = claimed[0]?.id
    return id ? this.prisma.outboundMessage.findUnique({ where: { id } }) : null
  }

  private async deliver(message: OutboundMessage) {
    const account = await this.prisma.messagingAccount.findUnique({
      where: { id: message.accountId },
    })
    if (!account?.enabled || account.storeId !== message.storeId) {
      await this.fail(message, new MessagingProviderError('Conta desabilitada.', 'account_disabled', false))
      return
    }

    try {
      const recipient = this.sandbox.assertRecipientAllowed(message.recipient)
      if (!(await this.canDeliverAiMessage(message))) {
        await this.fail(
          message,
          new MessagingProviderError(
            'Resposta da IA cancelada porque a conversa passou para atendimento humano.',
            'conversation_not_ai_active',
            false,
          ),
        )
        return
      }
      const provider = this.providers.forAccount(account)
      const result = await provider.send({
        account,
        recipient,
        contentType: message.contentType,
        payload: asRecord(message.payload),
        replyToExternalId: message.replyToExternalId,
      })
      const sentAt = new Date()
      await this.prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          externalMessageId: result.externalMessageId,
          sentAt,
          lockedAt: null,
          lockedBy: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      })
      await this.prisma.aiMessage.updateMany({
        where: { metadata: { equals: { outboundMessageId: message.id } } },
        data: { status: 'sent', sentAt },
      })
      await this.statuses.reconcileStored(account.id, result.externalMessageId)
    } catch (error) {
      const providerError =
        error instanceof MessagingProviderError
          ? error
          : new MessagingProviderError('Falha inesperada no provider.', 'unexpected_error', true)
      await this.fail(message, providerError)
    }
  }

  private async canDeliverAiMessage(message: OutboundMessage) {
    if (!message.conversationId) return true
    const aiMessage = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId: message.conversationId,
        senderType: 'ai',
        metadata: { equals: { outboundMessageId: message.id } },
      },
      select: { id: true },
    })
    if (!aiMessage) return true
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: message.conversationId },
      select: { operationalStatus: true },
    })
    return conversation?.operationalStatus === 'AI_ACTIVE'
  }

  private async fail(message: OutboundMessage, error: MessagingProviderError) {
    const shouldRetry = error.retryable && message.attempts < message.maxAttempts
    const now = new Date()
    const safeMessage = error.message.replace(/[\r\n\t]+/g, ' ').slice(0, 240)
    await this.prisma.outboundMessage.update({
      where: { id: message.id },
      data: shouldRetry
        ? {
            status: 'PENDING',
            availableAt: new Date(now.getTime() + retryDelayMs(message.attempts)),
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: error.code.slice(0, 80),
            lastErrorMessage: safeMessage,
          }
        : {
            status: 'FAILED',
            failedAt: now,
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: error.code.slice(0, 80),
            lastErrorMessage: safeMessage,
          },
    })

    if (!shouldRetry) {
      await this.prisma.aiMessage.updateMany({
        where: { metadata: { equals: { outboundMessageId: message.id } } },
        data: { status: 'failed', failedAt: now, errorMessage: safeMessage },
      })
      this.logger.warn(`Outbound ${message.id} falhou definitivamente com ${error.code}.`)
    }
  }
}

export function retryDelayMs(attempt: number) {
  const exponential = Math.min(15 * 60_000, 1_000 * 2 ** Math.max(0, attempt - 1))
  return exponential + Math.floor(Math.random() * Math.min(1_000, exponential / 4))
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
