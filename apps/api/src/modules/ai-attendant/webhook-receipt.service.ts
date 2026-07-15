import { ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

export interface WebhookReceiptInput {
  storeId: string
  sessionId: string
  provider: string
  eventId: string
  requestHash: string
}

@Injectable()
export class WebhookReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(input: WebhookReceiptInput) {
    try {
      await this.prisma.webhookReceipt.create({
        data: {
          ...input,
          status: 'accepted',
          processedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      return { duplicate: false }
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error
      }

      const existing = await this.prisma.webhookReceipt.findUnique({
        where: {
          provider_sessionId_eventId: {
            provider: input.provider,
            sessionId: input.sessionId,
            eventId: input.eventId,
          },
        },
      })

      if (existing?.requestHash !== input.requestHash) {
        throw new ConflictException(
          'Identificador de webhook reutilizado com conteudo diferente.',
        )
      }

      return { duplicate: true }
    }
  }
}

function isUniqueViolation(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002')
  )
}
