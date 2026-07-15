import assert from 'node:assert/strict'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'

import type { OrdersService } from '@/modules/orders/orders.service'
import { DriversService } from '@/modules/drivers/drivers.service'
import { WebhookReceiptService } from '@/modules/ai-attendant/webhook-receipt.service'
import type { PrismaService } from '@/shared/prisma/prisma.service'
import type { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { IdempotencyService } from '@/shared/security/idempotency.service'
import { runWithStoreContext } from '@/shared/store-context'

test(
  'integracao: isolamento por loja, idempotencia e deduplicacao persistida',
  { skip: process.env.RUN_DB_INTEGRATION !== '1' },
  async () => {
    const databaseUrl = process.env.DATABASE_URL ?? ''
    assert.match(databaseUrl, /accdel_(?:security|empty|incremental)_test/)
    const prisma = new PrismaClient()
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const storeA = `security-store-a-${suffix}`
    const storeB = `security-store-b-${suffix}`
    const driverB = `security-driver-b-${suffix}`

    try {
      await prisma.store.createMany({
        data: [
          {
            id: storeA,
            name: 'Security Store A',
            tradeName: 'Security Store A',
            city: 'Manaus',
            state: 'AM',
            brandAccent: '#000000',
          },
          {
            id: storeB,
            name: 'Security Store B',
            tradeName: 'Security Store B',
            city: 'Manaus',
            state: 'AM',
            brandAccent: '#000000',
          },
        ],
      })
      await prisma.user.create({
        data: {
          id: driverB,
          name: 'Driver B',
          email: `${driverB}@example.test`,
          passwordHash: 'not-used-in-integration-test',
          stores: {
            create: {
              storeId: storeB,
              role: 'driver',
              driverProfile: { create: { vehicle: 'Bike' } },
            },
          },
        },
      })
      const sessionA = await prisma.whatsappSession.create({
        data: {
          storeId: storeA,
          provider: 'evolution_api',
          sessionName: `session-${suffix}`,
        },
      })
      const prismaService = prisma as unknown as PrismaService
      const drivers = new DriversService(
        prismaService,
        {} as OrdersService,
        {} as AdminRealtimeService,
      )

      await assert.rejects(() =>
        runWithStoreContext(
          { storeId: storeA, source: 'auth' },
          () => drivers.getDriverById(driverB),
        ),
      )

      const idempotency = new IdempotencyService(prismaService)
      const request = {
        storeId: storeA,
        actorId: 'integration-user',
        operation: 'orders:create',
        key: `integration-${suffix}`,
        requestHash: 'same-request-hash',
        ttlMs: 60_000,
      }
      const started = await idempotency.begin(request)
      assert.equal(started.kind, 'started')
      if (started.kind === 'started') {
        await idempotency.complete(started.recordId, { data: { id: 'order-once' } })
      }
      assert.deepEqual(await idempotency.begin(request), {
        kind: 'replay',
        response: { data: { id: 'order-once' } },
      })

      const receipts = new WebhookReceiptService(prismaService)
      const receipt = {
        storeId: storeA,
        sessionId: sessionA.id,
        provider: 'evolution_api',
        eventId: `message-${suffix}`,
        requestHash: 'same-webhook-hash',
      }
      assert.equal((await receipts.claim(receipt)).duplicate, false)
      assert.equal((await receipts.claim(receipt)).duplicate, true)
    } finally {
      await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } })
      await prisma.user.deleteMany({ where: { id: driverB } })
      await prisma.$disconnect()
    }
  },
)
