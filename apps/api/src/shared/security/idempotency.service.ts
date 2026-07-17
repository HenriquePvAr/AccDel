import { ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

interface BeginIdempotencyInput {
  storeId: string
  actorId: string
  operation: string
  key: string
  requestHash: string
  ttlMs: number
}

export type IdempotencyStart =
  | { kind: 'started'; recordId: string }
  | { kind: 'replay'; response: unknown }

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async begin(input: BeginIdempotencyInput): Promise<IdempotencyStart> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        storeId_actorId_operation_key: {
          storeId: input.storeId,
          actorId: input.actorId,
          operation: input.operation,
          key: input.key,
        },
      },
    })

    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        throw new ConflictException(
          'A mesma chave de idempotencia foi usada com outro payload.',
        )
      }

      if (existing.status === 'completed' && existing.expiresAt > new Date()) {
        return { kind: 'replay', response: existing.responseData }
      }

      if (existing.status === 'processing' && existing.expiresAt > new Date()) {
        throw new ConflictException('Uma requisicao identica ainda esta em processamento.')
      }

      await this.prisma.idempotencyRecord.delete({ where: { id: existing.id } })
    }

    try {
      const created = await this.prisma.idempotencyRecord.create({
        data: {
          storeId: input.storeId,
          actorId: input.actorId,
          operation: input.operation,
          key: input.key,
          requestHash: input.requestHash,
          expiresAt: new Date(Date.now() + input.ttlMs),
        },
      })

      return { kind: 'started', recordId: created.id }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Uma requisicao identica ainda esta em processamento.')
      }

      throw error
    }
  }

  async complete(recordId: string, response: unknown) {
    const responseData = JSON.parse(JSON.stringify(response ?? null)) as Prisma.InputJsonValue
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: { status: 'completed', responseData },
    })
  }

  async abort(recordId: string) {
    await this.prisma.idempotencyRecord.deleteMany({ where: { id: recordId } })
  }
}
