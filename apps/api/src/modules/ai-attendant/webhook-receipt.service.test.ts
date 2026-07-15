import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrismaService } from '@/shared/prisma/prisma.service'

import { WebhookReceiptService, type WebhookReceiptInput } from './webhook-receipt.service'

test('a mesma mensagem da mesma loja e processada uma unica vez', async () => {
  const records = new Map<string, WebhookReceiptInput>()
  const prisma = {
    webhookReceipt: {
      create: ({ data }: { data: WebhookReceiptInput }) => {
        const key = `${data.provider}:${data.sessionId}:${data.eventId}`
        if (records.has(key)) {
          return Promise.reject({ code: 'P2002' })
        }
        records.set(key, data)
        return Promise.resolve(data)
      },
      findUnique: ({ where }: { where: { provider_sessionId_eventId: {
        provider: string
        sessionId: string
        eventId: string
      } } }) => {
        const keyParts = where.provider_sessionId_eventId
        return Promise.resolve(
          records.get(`${keyParts.provider}:${keyParts.sessionId}:${keyParts.eventId}`) ?? null,
        )
      },
    },
  } as unknown as PrismaService
  const service = new WebhookReceiptService(prisma)
  const input = {
    storeId: 'store-a',
    sessionId: 'session-a',
    provider: 'evolution_api',
    eventId: 'message-a',
    requestHash: 'hash-a',
  }

  assert.equal((await service.claim(input)).duplicate, false)
  assert.equal((await service.claim(input)).duplicate, true)
  assert.equal(records.size, 1)
})

test('rejeita replay que reutiliza id com conteudo diferente', async () => {
  const existing = {
    storeId: 'store-a',
    sessionId: 'session-a',
    provider: 'evolution_api',
    eventId: 'message-a',
    requestHash: 'hash-original',
  }
  const prisma = {
    webhookReceipt: {
      create: () => Promise.reject({ code: 'P2002' }),
      findUnique: () => Promise.resolve(existing),
    },
  } as unknown as PrismaService
  const service = new WebhookReceiptService(prisma)

  await assert.rejects(() => service.claim({ ...existing, requestHash: 'hash-attacker' }))
})
