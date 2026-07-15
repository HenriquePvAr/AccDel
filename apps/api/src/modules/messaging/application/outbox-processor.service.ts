import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { OutboundMessage } from '@prisma/client'
import { randomUUID } from 'node:crypto'

import { PrismaService } from '@/shared/prisma/prisma.service'

import { MessagingProviderError } from '../domain/messaging-provider'
import { MessagingProviderRouter } from './messaging-provider-router.service'

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
    const now = new Date()
    const staleLock = new Date(now.getTime() - 5 * 60 * 1_000)
    const candidate = await this.prisma.outboundMessage.findFirst({
      where: {
        availableAt: { lte: now },
        OR: [
          { status: 'PENDING' },
          { status: 'SENDING', lockedAt: { lt: staleLock } },
        ],
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    })
    if (!candidate) return null

    const claimed = await this.prisma.outboundMessage.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        updatedAt: candidate.updatedAt,
      },
      data: {
        status: 'SENDING',
        lockedAt: now,
        lockedBy: this.workerId,
        lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    })
    if (claimed.count !== 1) return null

    return this.prisma.outboundMessage.findUnique({ where: { id: candidate.id } })
  }

  private async deliver(message: OutboundMessage) {
    const account = await this.prisma.messagingAccount.findUnique({
      where: { id: message.accountId },
    })
    if (!account?.enabled) {
      await this.fail(message, new MessagingProviderError('Conta desabilitada.', 'account_disabled', false))
      return
    }

    try {
      const provider = this.providers.forAccount(account)
      const result = await provider.send({
        account,
        recipient: message.recipient,
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
    } catch (error) {
      const providerError =
        error instanceof MessagingProviderError
          ? error
          : new MessagingProviderError('Falha inesperada no provider.', 'unexpected_error', true)
      await this.fail(message, providerError)
    }
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
