import assert from 'node:assert/strict'
import test from 'node:test'

import { Prisma, PrismaClient } from '@prisma/client'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import type { PrismaService } from '@/shared/prisma/prisma.service'
import { runWithStoreContext } from '@/shared/store-context'

import { PrintAgentService } from './print-agent.service'
import { PrintingAdminService } from './printing-admin.service'
import { PrintingPolicyService } from './printing-policy.service'
import type { AuthenticatedPrintAgent } from './printing.types'

const integrationOptions = {
  skip: process.env.RUN_DB_INTEGRATION !== '1',
  timeout: 180_000,
}

test(
  'impressao PostgreSQL: replay, claim concorrente, tenant, lease e confirmacao duplicada',
  integrationOptions,
  async () => {
    assertSafeIntegrationDatabase()
    const prisma = new PrismaClient()
    const suffix = uniqueSuffix()
    const fixtureA = await createFixture(prisma, `core-a-${suffix}`)
    const fixtureB = await createFixture(prisma, `core-b-${suffix}`)
    const policy = new PrintingPolicyService()
    const serviceA = new PrintAgentService(prisma as unknown as PrismaService)
    const serviceASecondInstance = new PrintAgentService(prisma as unknown as PrismaService)
    const serviceB = new PrintAgentService(prisma as unknown as PrismaService)

    try {
      const firstIds = await createOrderJobs(prisma, policy, fixtureA, 'core-order', 'core-event')
      const replayIds = await createOrderJobs(
        prisma,
        policy,
        fixtureA,
        'core-order',
        'core-event',
        true,
      )
      assert.deepEqual(replayIds, firstIds)
      assert.equal(
        await prisma.printJob.count({ where: { storeId: fixtureA.storeId } }),
        2,
      )
      assert.equal(
        await prisma.printAuditLog.count({
          where: { storeId: fixtureA.storeId, action: 'JOB_CREATED' },
        }),
        2,
      )
      assert.equal(
        await prisma.printJob.count({
          where: {
            storeId: fixtureA.storeId,
            printerId: fixtureA.kitchenPrinterId,
            status: 'PENDING',
          },
        }),
        1,
      )
      assert.equal(
        await prisma.printer.count({
          where: {
            id: fixtureA.kitchenPrinterId,
            storeId: fixtureA.storeId,
            agentId: fixtureA.agent.id,
            enabled: true,
          },
        }),
        1,
      )
      const directCandidates = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT j.id
        FROM print_jobs AS j
        INNER JOIN printers AS p ON p.id = j.printer_id
        WHERE j.store_id = ${fixtureA.storeId}
          AND p.store_id = ${fixtureA.storeId}
          AND p.agent_id = ${fixtureA.agent.id}
          AND p.enabled = TRUE
          AND p.id = ${fixtureA.kitchenPrinterId}
          AND j.status IN ('PENDING'::"PrintJobStatus", 'RETRY_WAIT'::"PrintJobStatus")
          AND j.available_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          AND j.attempt_count < j.max_attempts
      `)
      assert.equal(
        directCandidates.length,
        1,
      )

      assert.deepEqual(
        (
          await serviceB.claim(fixtureB.agent, {
            limit: 20,
            availablePrinterIds: [fixtureA.kitchenPrinterId],
          })
        ).data,
        [],
      )

      const competingClaims = await Promise.all([
        serviceA.claim(fixtureA.agent, {
          limit: 1,
          availablePrinterIds: [fixtureA.kitchenPrinterId],
        }),
        serviceASecondInstance.claim(fixtureA.agent, {
          limit: 1,
          availablePrinterIds: [fixtureA.kitchenPrinterId],
        }),
      ])
      const claimed = competingClaims.flatMap((entry) => entry.data)
      assert.equal(claimed.length, 1)
      assert.equal(new Set(claimed.map((entry) => entry.id)).size, 1)

      const kitchenJob = claimed[0]!
      await serviceA.markStarted(fixtureA.agent, kitchenJob.id, {
        leaseToken: kitchenJob.leaseToken,
      })
      const confirmations = await Promise.all([
        serviceA.markSuccess(fixtureA.agent, kitchenJob.id, {
          leaseToken: kitchenJob.leaseToken,
          contentHash: 'a'.repeat(64),
          durationMs: 25,
        }),
        serviceASecondInstance.markSuccess(fixtureA.agent, kitchenJob.id, {
          leaseToken: kitchenJob.leaseToken,
          contentHash: 'a'.repeat(64),
          durationMs: 25,
        }),
      ])
      assert.equal(confirmations.filter((entry) => entry.data.idempotent).length, 1)
      assert.equal(
        await prisma.printAuditLog.count({
          where: { jobId: kitchenJob.id, action: 'JOB_PRINTED' },
        }),
        1,
      )

      const barClaim = (
        await serviceA.claim(fixtureA.agent, {
          limit: 1,
          availablePrinterIds: [fixtureA.barPrinterId],
        })
      ).data[0]!
      await serviceA.markStarted(fixtureA.agent, barClaim.id, {
        leaseToken: barClaim.leaseToken,
      })
      await prisma.printJob.update({
        where: { id: barClaim.id },
        data: { leaseExpiresAt: new Date(Date.now() - 60_000) },
      })
      await serviceA.claim(fixtureA.agent, {
        limit: 1,
        availablePrinterIds: [fixtureA.barPrinterId],
      })
      assert.equal(
        (await prisma.printJob.findUniqueOrThrow({ where: { id: barClaim.id } })).status,
        'PRINT_RESULT_UNKNOWN',
      )

      const leaseJobId = await createDirectJob(
        prisma,
        fixtureA,
        'lease-before-start',
        fixtureA.kitchenStationId,
        fixtureA.kitchenPrinterId,
      )
      const firstLease = (
        await serviceA.claim(fixtureA.agent, {
          limit: 1,
          availablePrinterIds: [fixtureA.kitchenPrinterId],
        })
      ).data.find((entry) => entry.id === leaseJobId)
      assert.ok(firstLease)
      await prisma.printJob.update({
        where: { id: leaseJobId },
        data: { leaseExpiresAt: new Date(Date.now() - 60_000) },
      })
      const recoveredLease = (
        await serviceA.claim(fixtureA.agent, {
          limit: 1,
          availablePrinterIds: [fixtureA.kitchenPrinterId],
        })
      ).data[0]
      assert.ok(
        recoveredLease,
        JSON.stringify(await prisma.printJob.findUnique({ where: { id: leaseJobId } })),
      )
      assert.equal(recoveredLease.id, leaseJobId)
      assert.equal(recoveredLease.attemptNumber, 2)

      const admin = new PrintingAdminService(prisma as unknown as PrismaService)
      const reprint = await runWithStoreContext(
        { storeId: fixtureA.storeId, source: 'auth' },
        () =>
          admin.reprintJob(
            kitchenJob.id,
            { reason: 'Cupom danificado durante o teste' },
            actor(fixtureA.storeId),
          ),
      )
      assert.equal(reprint.data.originalJobId, kitchenJob.id)
      assert.equal(reprint.data.jobType, 'REPRINT')
      assert.equal(
        (reprint.data.payloadSnapshot as { marker: string }).marker,
        'REIMPRESSAO',
      )
    } finally {
      await cleanupStores(prisma, [fixtureA.storeId, fixtureB.storeId])
      await prisma.$disconnect()
    }
  },
)

test(
  'simulacao operacional: 40 pedidos, dois setores, falhas temporarias e queda',
  integrationOptions,
  async () => {
    assertSafeIntegrationDatabase()
    const prisma = new PrismaClient()
    const suffix = uniqueSuffix()
    const fixture = await createFixture(prisma, `simulation-40-${suffix}`)
    const policy = new PrintingPolicyService()
    const service = new PrintAgentService(prisma as unknown as PrismaService)
    const claimedAttempts = new Set<string>()
    let transientFailures = 0
    let ambiguousJobId: string | null = null

    try {
      for (let index = 0; index < 40; index += 1) {
        await createOrderJobs(
          prisma,
          policy,
          fixture,
          `simulation-order-${index}`,
          `simulation-event-${index}`,
        )
      }
      assert.equal(await prisma.printJob.count({ where: { storeId: fixture.storeId } }), 80)

      for (let cycle = 0; cycle < 30; cycle += 1) {
        const response = await service.claim(fixture.agent, {
          limit: 20,
          availablePrinterIds: [fixture.kitchenPrinterId, fixture.barPrinterId],
        })
        if (!response.data.length) {
          const active = await prisma.printJob.count({
            where: {
              storeId: fixture.storeId,
              status: { in: ['PENDING', 'CLAIMED', 'PRINTING', 'RETRY_WAIT'] },
            },
          })
          if (!active) break
          await prisma.printJob.updateMany({
            where: { storeId: fixture.storeId, status: 'RETRY_WAIT' },
            data: { availableAt: new Date(0) },
          })
          continue
        }

        for (const job of response.data) {
          const claimKey = `${job.id}:${job.attemptNumber}`
          assert.equal(claimedAttempts.has(claimKey), false)
          claimedAttempts.add(claimKey)
          await service.markStarted(fixture.agent, job.id, { leaseToken: job.leaseToken })

          if (!ambiguousJobId) {
            ambiguousJobId = job.id
            await prisma.printJob.update({
              where: { id: job.id },
              data: { leaseExpiresAt: new Date(Date.now() - 60_000) },
            })
            continue
          }

          const shouldFailTemporarily =
            job.attemptNumber === 1 &&
            Number.parseInt(job.id.slice(-2), 16) % 17 === 0
          if (shouldFailTemporarily) {
            transientFailures += 1
            await service.markFailure(fixture.agent, job.id, {
              leaseToken: job.leaseToken,
              retryable: true,
              errorCode: 'SIMULATED_TEMPORARY_FAILURE',
              errorMessage: 'Falha temporaria sintetica sem payload.',
              durationMs: 15,
            })
          } else {
            await service.markSuccess(fixture.agent, job.id, {
              leaseToken: job.leaseToken,
              contentHash: 'b'.repeat(64),
              durationMs: 20,
            })
          }
        }
        await prisma.printJob.updateMany({
          where: { storeId: fixture.storeId, status: 'RETRY_WAIT' },
          data: { availableAt: new Date(0) },
        })
      }

      const counts = await prisma.printJob.groupBy({
        by: ['status'],
        where: { storeId: fixture.storeId },
        _count: { _all: true },
      })
      const byStatus = Object.fromEntries(
        counts.map((entry) => [entry.status, entry._count._all]),
      )
      assert.equal(byStatus.PRINTED, 79)
      assert.equal(byStatus.PRINT_RESULT_UNKNOWN, 1)
      assert.equal(
        ['PENDING', 'CLAIMED', 'PRINTING', 'RETRY_WAIT', 'FAILED'].reduce(
          (sum, status) => sum + Number(byStatus[status] ?? 0),
          0,
        ),
        0,
      )
      assert.ok(transientFailures > 0)
      assert.ok(ambiguousJobId)
      assert.equal(
        await prisma.printJobAttempt.count({
          where: { job: { storeId: fixture.storeId }, status: 'RETRY_SCHEDULED' },
        }),
        transientFailures,
      )
      assert.equal(
        await prisma.printAuditLog.count({
          where: { storeId: fixture.storeId, action: 'JOB_PRINTED' },
        }),
        79,
      )
    } finally {
      await cleanupStores(prisma, [fixture.storeId])
      await prisma.$disconnect()
    }
  },
)

test(
  'carga operacional: 500 jobs sem perda ou claim duplicado',
  integrationOptions,
  async () => {
    assertSafeIntegrationDatabase()
    const prisma = new PrismaClient()
    const suffix = uniqueSuffix()
    const fixture = await createFixture(prisma, `load-500-${suffix}`)
    const service = new PrintAgentService(prisma as unknown as PrismaService)
    const claimedIds = new Set<string>()
    let batches = 0

    try {
      await prisma.printJob.createMany({
        data: Array.from({ length: 500 }, (_, index) => ({
          id: `loadjob-${suffix}-${String(index).padStart(4, '0')}`,
          storeId: fixture.storeId,
          stationId: fixture.kitchenStationId,
          stationCode: 'COZINHA',
          printerId: fixture.kitchenPrinterId,
          jobType: 'ORDER_INITIAL' as const,
          templateKey: 'kitchen-order',
          templateVersion: 'v1',
          payloadSnapshot: { schemaVersion: 1, synthetic: true, index },
          payloadHash: String(index).padStart(64, '0').slice(-64),
          idempotencyKey: `load-500:${index}`,
          priority: index % 25 === 0 ? 50 : 0,
        })),
      })
      assert.equal(
        await prisma.printJob.count({
          where: { storeId: fixture.storeId, status: 'PENDING' },
        }),
        500,
      )

      while (true) {
        const response = await service.claim(fixture.agent, {
          limit: 20,
          availablePrinterIds: [fixture.kitchenPrinterId],
        })
        if (!response.data.length) break
        batches += 1
        for (const job of response.data) {
          assert.equal(claimedIds.has(job.id), false)
          claimedIds.add(job.id)
        }
        await Promise.all(
          response.data.map(async (job) => {
            await service.markStarted(fixture.agent, job.id, {
              leaseToken: job.leaseToken,
            })
            await service.markSuccess(fixture.agent, job.id, {
              leaseToken: job.leaseToken,
              contentHash: 'c'.repeat(64),
              durationMs: 5,
            })
          }),
        )
      }

      assert.equal(batches, 25)
      assert.equal(claimedIds.size, 500)
      assert.equal(
        await prisma.printJob.count({
          where: { storeId: fixture.storeId, status: 'PRINTED' },
        }),
        500,
      )
      assert.equal(
        await prisma.printJobAttempt.count({
          where: { job: { storeId: fixture.storeId }, status: 'PRINTED' },
        }),
        500,
      )
    } finally {
      await cleanupStores(prisma, [fixture.storeId])
      await prisma.$disconnect()
    }
  },
)

interface PrintingFixture {
  storeId: string
  kitchenStationId: string
  barStationId: string
  kitchenPrinterId: string
  barPrinterId: string
  kitchenProductId: string
  barProductId: string
  agent: AuthenticatedPrintAgent
}

async function createFixture(
  prisma: PrismaClient,
  label: string,
): Promise<PrintingFixture> {
  const storeId = `printing-store-${label}`
  await prisma.store.create({
    data: {
      id: storeId,
      name: `Printing ${label}`,
      tradeName: `Printing ${label}`,
      city: 'Manaus',
      state: 'AM',
      brandAccent: '#C65D2E',
    },
  })
  const [foodCategory, drinkCategory] = await Promise.all([
    prisma.category.create({
      data: { storeId, name: 'Comidas', description: 'Teste', sortOrder: 1 },
    }),
    prisma.category.create({
      data: { storeId, name: 'Bebidas', description: 'Teste', sortOrder: 2 },
    }),
  ])
  const [kitchenProduct, barProduct] = await Promise.all([
    prisma.product.create({
      data: {
        storeId,
        categoryId: foodCategory.id,
        name: 'Pizza sintetica',
        description: 'Somente teste',
        price: 30,
        image: 'https://example.invalid/pizza.png',
        preparationStation: 'COZINHA',
      },
    }),
    prisma.product.create({
      data: {
        storeId,
        categoryId: drinkCategory.id,
        name: 'Suco sintetico',
        description: 'Somente teste',
        price: 8,
        image: 'https://example.invalid/suco.png',
        preparationStation: 'BAR',
      },
    }),
  ])
  const agentRecord = await prisma.printAgent.create({
    data: {
      storeId,
      name: 'Agente de teste',
      deviceName: 'Windows sintetico',
      tokenHash: `hash-${label}`,
      tokenPrefix: `cpa_${label.slice(-12)}`,
      enabled: true,
    },
  })
  const [kitchenStation, barStation] = await Promise.all([
    prisma.printerStation.create({ data: { storeId, code: 'COZINHA', name: 'Cozinha' } }),
    prisma.printerStation.create({ data: { storeId, code: 'BAR', name: 'Bar' } }),
  ])
  const [kitchenPrinter, barPrinter] = await Promise.all([
    prisma.printer.create({
      data: {
        storeId,
        stationId: kitchenStation.id,
        agentId: agentRecord.id,
        name: 'Cozinha virtual',
        connectionType: 'FILE_OR_VIRTUAL',
        address: 'dry-run-kitchen',
        paperWidth: 80,
        enabled: true,
        isDefault: true,
      },
    }),
    prisma.printer.create({
      data: {
        storeId,
        stationId: barStation.id,
        agentId: agentRecord.id,
        name: 'Bar virtual',
        connectionType: 'FILE_OR_VIRTUAL',
        address: 'dry-run-bar',
        paperWidth: 58,
        enabled: true,
        isDefault: true,
      },
    }),
  ])
  await prisma.printingSettings.create({
    data: {
      storeId,
      enabled: true,
      fallbackPolicy: 'DEFAULT_STATION',
      fallbackStationId: kitchenStation.id,
      defaultMaxAttempts: 5,
      leaseDurationSeconds: 60,
    },
  })
  await prisma.printerRoutingRule.createMany({
    data: [
      {
        storeId,
        scope: 'CATEGORY',
        categoryId: foodCategory.id,
        stationId: kitchenStation.id,
      },
      {
        storeId,
        scope: 'CATEGORY',
        categoryId: drinkCategory.id,
        stationId: barStation.id,
      },
    ],
  })
  return {
    storeId,
    kitchenStationId: kitchenStation.id,
    barStationId: barStation.id,
    kitchenPrinterId: kitchenPrinter.id,
    barPrinterId: barPrinter.id,
    kitchenProductId: kitchenProduct.id,
    barProductId: barProduct.id,
    agent: {
      id: agentRecord.id,
      storeId,
      name: agentRecord.name,
      version: null,
    },
  }
}

async function createOrderJobs(
  prisma: PrismaClient,
  policy: PrintingPolicyService,
  fixture: PrintingFixture,
  orderLabel: string,
  eventLabel: string,
  replay = false,
) {
  const orderId = `${fixture.storeId}-${orderLabel}`
  const order = replay
    ? await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    : await prisma.order.create({
        data: {
          id: orderId,
          storeId: fixture.storeId,
          number: orderLabel,
          customerName: 'Cliente sintetico',
          customerPhone: '+5592000000000',
          source: 'delivery',
          serviceType: 'delivery',
          status: 'in_preparation',
          paymentMethod: 'cash',
          paymentStatus: 'pending',
          subtotal: 38,
          deliveryFee: 5,
          discount: 0,
          total: 43,
          dueAt: new Date(Date.now() + 60_000),
          priority: 'normal',
          addressLabel: 'Endereco sintetico',
          addressText: 'Rua de Teste, 100',
        },
      })
  return prisma.$transaction((tx) =>
    policy.createOrderJobs(tx, {
      storeId: fixture.storeId,
      eventId: `${fixture.storeId}-${eventLabel}`,
      jobType: 'ORDER_INITIAL',
      order,
      items: [
        {
          productId: fixture.kitchenProductId,
          name: 'Pizza sintetica',
          quantity: 1,
          unitPrice: 30,
          notes: 'Sem cebola',
          options: [],
        },
        {
          productId: fixture.barProductId,
          name: 'Suco sintetico',
          quantity: 1,
          unitPrice: 8,
          notes: null,
          options: [],
        },
      ],
    }),
  )
}

async function createDirectJob(
  prisma: PrismaClient,
  fixture: PrintingFixture,
  label: string,
  stationId: string,
  printerId: string,
) {
  const id = `direct-${uniqueSuffix()}-${label}`
  await prisma.printJob.create({
    data: {
      id,
      storeId: fixture.storeId,
      stationId,
      stationCode: 'COZINHA',
      printerId,
      jobType: 'TEST_PAGE',
      templateKey: 'test-page',
      templateVersion: 'v1',
      payloadSnapshot: { schemaVersion: 1, synthetic: true },
      payloadHash: 'd'.repeat(64),
      idempotencyKey: `direct:${label}:${id}`,
    },
  })
  return id
}

function actor(storeId: string): AuthenticatedRequestUser {
  return {
    sub: `printing-admin-${storeId}`,
    email: 'printing-admin@example.test',
    name: 'Printing Admin',
    storeId,
    role: 'owner',
    permissions: ['printing:view', 'printing:manage', 'printing:reprint'],
  }
}

function assertSafeIntegrationDatabase() {
  assert.match(process.env.DATABASE_URL ?? '', /accdel_.*test/)
}

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function cleanupStores(prisma: PrismaClient, storeIds: string[]) {
  await prisma.printJob.deleteMany({ where: { storeId: { in: storeIds } } })
  await prisma.store.deleteMany({ where: { id: { in: storeIds } } })
}
