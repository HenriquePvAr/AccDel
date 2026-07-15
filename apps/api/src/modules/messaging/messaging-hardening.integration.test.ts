import assert from 'node:assert/strict'
import test from 'node:test'

import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '@prisma/client'

import { AiAttendantService } from '@/modules/ai-attendant/ai-attendant.service'
import type { PrismaService } from '@/shared/prisma/prisma.service'

import { ConversationWindowService } from './application/conversation-window.service'
import { MessagingOutboxService } from './application/messaging-outbox.service'
import { MessagingSandboxPolicy } from './application/messaging-sandbox-policy.service'
import { OutboundStatusService } from './application/outbound-status.service'
import { OutboxProcessorService } from './application/outbox-processor.service'
import type { MessagingProviderRouter } from './application/messaging-provider-router.service'

test(
  'integracao: outbox concorrente, sandbox, status monotono e disputa de handoff',
  { skip: process.env.RUN_DB_INTEGRATION !== '1' },
  async () => {
    const databaseUrl = process.env.DATABASE_URL ?? ''
    assert.match(databaseUrl, /accdel_.*test/)
    const prisma = new PrismaClient()
    const prismaService = prisma as unknown as PrismaService
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const storeA = `messaging-store-a-${suffix}`
    const storeB = `messaging-store-b-${suffix}`
    const userA = `messaging-user-a-${suffix}`
    const userB = `messaging-user-b-${suffix}`

    try {
      await prisma.store.deleteMany({ where: { id: { startsWith: 'messaging-store-' } } })
      await prisma.user.deleteMany({ where: { id: { startsWith: 'messaging-user-' } } })
      await prisma.store.createMany({
        data: [
          { id: storeA, name: 'Messaging A', tradeName: 'Messaging A', city: 'Manaus', state: 'AM', brandAccent: '#111111' },
          { id: storeB, name: 'Messaging B', tradeName: 'Messaging B', city: 'Manaus', state: 'AM', brandAccent: '#222222' },
        ],
      })
      await prisma.user.createMany({
        data: [
          { id: userA, name: 'Atendente A', email: `${userA}@example.test`, passwordHash: 'not-used' },
          { id: userB, name: 'Atendente B', email: `${userB}@example.test`, passwordHash: 'not-used' },
        ],
      })
      await prisma.storeUser.createMany({
        data: [
          { storeId: storeA, userId: userA, role: 'owner' },
          { storeId: storeA, userId: userB, role: 'owner' },
        ],
      })
      const session = await prisma.whatsappSession.create({
        data: { storeId: storeA, provider: 'whatsapp_cloud', sessionName: `cloud-${suffix}`, status: 'connected' },
      })
      const accountA = await prisma.messagingAccount.create({
        data: {
          storeId: storeA,
          provider: 'whatsapp_cloud',
          externalAccountId: `waba-a-${suffix}`,
          phoneNumberId: `phone-a-${suffix}`,
          legacySessionId: session.id,
        },
      })
      const accountB = await prisma.messagingAccount.create({
        data: {
          storeId: storeB,
          provider: 'whatsapp_cloud',
          externalAccountId: `waba-b-${suffix}`,
          phoneNumberId: `phone-b-${suffix}`,
        },
      })
      const conversation = await prisma.aiConversation.create({
        data: {
          storeId: storeA,
          whatsappSessionId: session.id,
          messagingAccountId: accountA.id,
          whatsappNumber: '5592999999999',
          customerName: 'Cliente de teste',
          lastInboundAt: new Date(),
          lastMessageAt: new Date(),
        },
      })
      const config = new ConfigService({
        WHATSAPP_PROVIDER: 'cloud',
        MESSAGING_SANDBOX_MODE: false,
        WHATSAPP_OUTBOX_MAX_ATTEMPTS: 3,
      })
      const outbox = new MessagingOutboxService(
        prismaService,
        config,
        new ConversationWindowService(),
      )

      await assert.rejects(() => outbox.enqueue({
        storeId: storeA,
        accountId: accountB.id,
        recipient: '5592999999999',
        contentType: 'TEXT',
        payload: { body: 'cross tenant' },
        idempotencyKey: `tenant:${suffix}`,
      }))

      await outbox.enqueueText({
        storeId: storeA,
        accountId: accountA.id,
        conversationId: conversation.id,
        recipient: conversation.whatsappNumber,
        body: 'primeira',
        idempotencyKey: `order:${suffix}:1`,
      })
      await assert.rejects(() => outbox.enqueueText({
        storeId: storeA,
        accountId: accountA.id,
        conversationId: conversation.id,
        recipient: conversation.whatsappNumber,
        body: 'conteudo divergente',
        idempotencyKey: `order:${suffix}:1`,
      }))
      await outbox.enqueueText({
        storeId: storeA,
        accountId: accountA.id,
        conversationId: conversation.id,
        recipient: conversation.whatsappNumber,
        body: 'segunda',
        idempotencyKey: `order:${suffix}:2`,
      })

      const sentBodies: string[] = []
      let releaseFirst!: () => void
      let markFirstStarted!: () => void
      const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
      const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve })
      const router = {
        forAccount: () => ({
          providerName: 'whatsapp_cloud',
          send: async (request: { payload: Record<string, unknown> }) => {
            const body = String(request.payload.body)
            sentBodies.push(body)
            if (body === 'primeira') {
              markFirstStarted()
              await firstGate
            }
            return { externalMessageId: `wamid.${body}.${suffix}` }
          },
        }),
      } as unknown as MessagingProviderRouter
      const statuses = new OutboundStatusService(prismaService)
      const policy = new MessagingSandboxPolicy(config)
      const workerA = new OutboxProcessorService(prismaService, config, router, policy, statuses)
      const workerB = new OutboxProcessorService(prismaService, config, router, policy, statuses)
      const firstTick = workerA.tick()
      await Promise.race([
        firstStarted,
        firstTick.then(() => { throw new Error('Worker terminou antes de iniciar o primeiro envio.') }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout aguardando o primeiro claim.')), 5_000)),
      ])
      await workerB.tick()
      assert.deepEqual(sentBodies, ['primeira'])
      releaseFirst()
      await firstTick
      await workerB.tick()
      assert.deepEqual(sentBodies, ['primeira', 'segunda'])

      const firstOutbound = await prisma.outboundMessage.findFirstOrThrow({
        where: { storeId: storeA, idempotencyKey: `order:${suffix}:1` },
      })
      await Promise.all([
        statuses.apply({
          accountId: accountA.id,
          externalMessageId: firstOutbound.externalMessageId!,
          status: 'READ',
          occurredAt: new Date('2026-07-15T00:02:00.000Z'),
        }),
        statuses.apply({
          accountId: accountA.id,
          externalMessageId: firstOutbound.externalMessageId!,
          status: 'DELIVERED',
          occurredAt: new Date('2026-07-15T00:01:00.000Z'),
        }),
      ])
      assert.equal(
        (await prisma.outboundMessage.findUniqueOrThrow({ where: { id: firstOutbound.id } })).status,
        'READ',
      )

      const blocked = await outbox.enqueueText({
        storeId: storeA,
        accountId: accountA.id,
        conversationId: conversation.id,
        recipient: conversation.whatsappNumber,
        body: 'bloqueada',
        idempotencyKey: `sandbox:${suffix}`,
      })
      const sandboxConfig = new ConfigService({
        WHATSAPP_PROVIDER: 'cloud',
        MESSAGING_SANDBOX_MODE: true,
        MESSAGING_ALLOWED_RECIPIENTS: '5511999999999',
      })
      const sandboxWorker = new OutboxProcessorService(
        prismaService,
        sandboxConfig,
        router,
        new MessagingSandboxPolicy(sandboxConfig),
        statuses,
      )
      await sandboxWorker.tick()
      const blockedResult = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: blocked.id } })
      assert.equal(blockedResult.status, 'FAILED')
      assert.equal(blockedResult.lastErrorCode, 'sandbox_recipient_blocked')
      assert.deepEqual(sentBodies, ['primeira', 'segunda'])

      await prisma.aiConversation.update({
        where: { id: conversation.id },
        data: { operationalStatus: 'WAITING_HUMAN', status: 'waiting_human' },
      })
      const aiReply = await outbox.enqueueText({
        storeId: storeA,
        accountId: accountA.id,
        conversationId: conversation.id,
        recipient: conversation.whatsappNumber,
        body: 'resposta da ia ainda pendente',
        idempotencyKey: `ai-race:${suffix}`,
        senderType: 'ai',
      })
      const aiService = new AiAttendantService(
        prismaService,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        config,
        outbox,
      )
      const claims = await Promise.allSettled([
        aiService.assignConversation(storeA, conversation.id, userA),
        aiService.assignConversation(storeA, conversation.id, userB),
      ])
      assert.equal(claims.filter((result) => result.status === 'fulfilled').length, 1)
      assert.equal(claims.filter((result) => result.status === 'rejected').length, 1)
      assert.equal(
        (await prisma.outboundMessage.findUniqueOrThrow({ where: { id: aiReply.id } })).status,
        'FAILED',
      )
    } finally {
      await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } })
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } })
      await prisma.$disconnect()
    }
  },
)
