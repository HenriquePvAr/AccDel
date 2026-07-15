import assert from 'node:assert/strict'
import test from 'node:test'
import { ConfigService } from '@nestjs/config'

import type { PrismaService } from '@/shared/prisma/prisma.service'

import { ConversationWindowService, CUSTOMER_SERVICE_WINDOW_MS } from './conversation-window.service'
import { phonesMatch } from './inbound-event-ingress.service'
import { MessagingSandboxPolicy } from './messaging-sandbox-policy.service'
import { OutboundStatusService } from './outbound-status.service'
import { retryDelayMs } from './outbox-processor.service'

test('janela de texto livre e estritamente menor que 24 horas', () => {
  const service = new ConversationWindowService()
  const now = new Date('2026-07-14T20:00:00.000Z')
  assert.equal(
    service.isFreeFormAllowed({ lastInboundAt: new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS + 1_000) }, now),
    true,
  )
  assert.equal(
    service.isFreeFormAllowed({ lastInboundAt: new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS) }, now),
    false,
  )
  assert.equal(
    service.isFreeFormAllowed({ lastInboundAt: new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS - 1_000) }, now),
    false,
  )
  assert.equal(service.isFreeFormAllowed({ lastInboundAt: new Date(now.getTime() + 1) }, now), false)
  assert.throws(() => service.assertFreeFormAllowed({ lastInboundAt: null }, now))
})

test('sandbox aceita apenas destinatarios normalizados da allowlist', () => {
  const enabled = new MessagingSandboxPolicy(new ConfigService({
    MESSAGING_SANDBOX_MODE: true,
    MESSAGING_ALLOWED_RECIPIENTS: '+55 (92) 99999-9999',
  }))
  assert.equal(enabled.assertRecipientAllowed('55 92 99999-9999'), '5592999999999')
  assert.throws(() => enabled.assertRecipientAllowed('5511999999999'))
  assert.throws(() => enabled.assertRecipientAllowed('123'))
})

test('telefone so vincula cliente quando o numero canonico completo coincide', () => {
  assert.equal(phonesMatch('+55 (92) 99999-9999', '5592999999999'), true)
  assert.equal(phonesMatch('5511999999999', '5592999999999'), false)
})

test('backoff cresce exponencialmente e permanece limitado', () => {
  for (const [attempt, base] of [[1, 1_000], [2, 2_000], [3, 4_000]] as const) {
    const delay = retryDelayMs(attempt)
    assert.ok(delay >= base)
    assert.ok(delay < base + Math.min(1_000, base / 4))
  }
  assert.ok(retryDelayMs(20) < 15 * 60_000 + 1_000)
})

test('status atrasado nao regride mensagem ja lida', async () => {
  let updates = 0
  const prisma = {
    outboundMessage: {
      findUnique: () => Promise.resolve({
        id: 'out-1',
        status: 'READ',
        sentAt: new Date('2026-07-14T19:00:00Z'),
        deliveredAt: new Date('2026-07-14T19:01:00Z'),
        readAt: new Date('2026-07-14T19:02:00Z'),
        failedAt: null,
        updatedAt: new Date('2026-07-14T19:02:00Z'),
      }),
      update: () => { updates += 1; return Promise.resolve(null) },
    },
    aiMessage: { updateMany: () => Promise.resolve({ count: 0 }) },
  } as unknown as PrismaService
  const service = new OutboundStatusService(prisma)
  const result = await service.apply({
    accountId: 'account-1',
    externalMessageId: 'wamid-1',
    status: 'DELIVERED',
    occurredAt: new Date('2026-07-14T19:01:30Z'),
  })
  assert.deepEqual(result, { matched: true, updated: false })
  assert.equal(updates, 0)
})
