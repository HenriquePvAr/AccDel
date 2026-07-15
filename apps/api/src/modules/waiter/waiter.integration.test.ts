import assert from 'node:assert/strict'
import test from 'node:test'

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { CatalogService } from '@/modules/catalog/catalog.service'
import { DiningService } from '@/modules/dining/dining.service'
import { PrintingPolicyService } from '@/modules/printing/printing-policy.service'
import type { PrismaService } from '@/shared/prisma/prisma.service'
import { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { runWithStoreContext } from '@/shared/store-context'

import { WaiterService } from './waiter.service'

test(
  'garcom PostgreSQL: tenant, ownership, preco, concorrencia, producao e impressao',
  { skip: process.env.RUN_DB_INTEGRATION !== '1', timeout: 60_000 },
  async () => {
    assert.match(process.env.DATABASE_URL ?? '', /accdel_.*test/)
    const prisma = new PrismaClient()
    const db = prisma as unknown as PrismaService
    const realtime = new AdminRealtimeService()
    const printing = new PrintingPolicyService()
    const dining = new DiningService(db, realtime, printing)
    const catalog = new CatalogService(db, realtime)
    const waiter = new WaiterService(db, dining, catalog, printing, realtime)
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const storeA = `waiter-store-a-${suffix}`
    const storeB = `waiter-store-b-${suffix}`
    const waiterA = `waiter-user-a-${suffix}`
    const waiterOther = `waiter-user-other-${suffix}`
    const productId = `waiter-product-${suffix}`

    try {
      await prisma.store.createMany({
        data: [
          { id: storeA, name: 'Waiter A', tradeName: 'Waiter A', city: 'Manaus', state: 'AM', brandAccent: '#116149' },
          { id: storeB, name: 'Waiter B', tradeName: 'Waiter B', city: 'Manaus', state: 'AM', brandAccent: '#551133' },
        ],
      })
      for (const [id, name] of [[waiterA, 'Garcom A'], [waiterOther, 'Garcom B']] as const) {
        await prisma.user.create({
          data: {
            id,
            name,
            email: `${id}@example.test`,
            passwordHash: 'not-used-in-integration-test',
            stores: {
              create: {
                storeId: storeA,
                role: 'waiter',
                waiterProfile: { create: {} },
              },
            },
          },
        })
      }
      const [areaA, areaB] = await Promise.all([
        prisma.diningArea.create({ data: { storeId: storeA, name: 'Salao A', color: '#116149' } }),
        prisma.diningArea.create({ data: { storeId: storeB, name: 'Salao B', color: '#551133' } }),
      ])
      const [tableA, tableB] = await Promise.all([
        prisma.diningTable.create({ data: { storeId: storeA, areaId: areaA.id, code: 'A1', capacity: 4 } }),
        prisma.diningTable.create({ data: { storeId: storeB, areaId: areaB.id, code: 'B1', capacity: 4 } }),
      ])
      const category = await prisma.category.create({
        data: { storeId: storeA, name: 'Pratos', description: 'Integracao waiter' },
      })
      await prisma.product.create({
        data: {
          id: productId,
          storeId: storeA,
          categoryId: category.id,
          name: 'Prato atual',
          description: 'Preco definido no servidor',
          price: 99,
          image: 'https://example.invalid/waiter-product.png',
          preparationStation: 'COZINHA',
          availability: {
            create: {
              channel: 'dine_in',
              available: true,
              visible: true,
              soldOut: false,
              priceOverride: 31.5,
            },
          },
        },
      })
      const agent = await prisma.printAgent.create({
        data: {
          storeId: storeA,
          name: 'Agente virtual waiter',
          deviceName: 'Windows sintetico',
          tokenHash: `hash-${suffix}`,
          tokenPrefix: `cpa_${suffix.slice(-12)}`,
        },
      })
      const station = await prisma.printerStation.create({
        data: { storeId: storeA, code: 'COZINHA', name: 'Cozinha' },
      })
      await prisma.printer.create({
        data: {
          storeId: storeA,
          stationId: station.id,
          agentId: agent.id,
          name: 'Impressora virtual waiter',
          connectionType: 'FILE_OR_VIRTUAL',
          address: 'dry-run-waiter',
          paperWidth: 80,
          isDefault: true,
        },
      })
      await prisma.printingSettings.create({
        data: {
          storeId: storeA,
          enabled: true,
          fallbackPolicy: 'DEFAULT_STATION',
          fallbackStationId: station.id,
        },
      })
      await prisma.printerRoutingRule.create({
        data: {
          storeId: storeA,
          scope: 'CATEGORY',
          categoryId: category.id,
          stationId: station.id,
        },
      })

      const asWaiterA = authUser(waiterA, storeA, 'Garcom A')
      const asOther = authUser(waiterOther, storeA, 'Garcom B')
      const inStoreA = <T>(operation: () => T) =>
        runWithStoreContext({ storeId: storeA, source: 'auth' }, operation)

      await assert.rejects(
        () => inStoreA(() => waiter.getTable(tableB.id)),
        (error: unknown) => error instanceof NotFoundException,
      )
      const opened = await inStoreA(() =>
        waiter.openSession(tableA.id, { guestCount: 2, expectedTableVersion: 1 }, asWaiterA),
      )
      const sessionId = opened.data.id
      assert.equal(opened.data.waiterId, waiterA)

      await assert.rejects(
        () => inStoreA(() => waiter.sendItems(sessionId, sendPayload(1, productId), asOther)),
        (error: unknown) => error instanceof ForbiddenException,
      )
      const firstRace = await Promise.allSettled([
        inStoreA(() => waiter.sendItems(sessionId, sendPayload(1, productId), asWaiterA)),
        inStoreA(() => waiter.sendItems(sessionId, sendPayload(1, productId), asWaiterA)),
      ])
      assert.equal(firstRace.filter((result) => result.status === 'fulfilled').length, 1)
      assert.equal(firstRace.filter((result) => result.status === 'rejected').length, 1)
      assert.ok(
        firstRace.some(
          (result) => result.status === 'rejected' && result.reason instanceof ConflictException,
        ),
      )

      const firstItem = await prisma.tableSessionItem.findFirstOrThrow({
        where: { sessionId },
        include: { productionOrder: true, productionOrderItem: true },
      })
      assert.equal(firstItem.unitPrice.toNumber(), 31.5)
      assert.equal(firstItem.totalPrice.toNumber(), 31.5)
      assert.equal(firstItem.productionOrder?.subtotal.toNumber(), 31.5)
      assert.equal(firstItem.productionOrderItem?.unitPrice.toNumber(), 31.5)
      assert.equal(await prisma.printJob.count({ where: { storeId: storeA, jobType: 'ORDER_INITIAL' } }), 1)

      await assert.rejects(
        () => inStoreA(() => waiter.sendItems(sessionId, sendPayload(1, productId), asWaiterA)),
        (error: unknown) => error instanceof ConflictException,
      )
      await inStoreA(() => waiter.sendItems(sessionId, sendPayload(2, productId), asWaiterA))
      const secondItem = await prisma.tableSessionItem.findFirstOrThrow({
        where: { sessionId, id: { not: firstItem.id } },
        include: { productionOrder: true },
      })
      assert.equal(await prisma.order.count({ where: { storeId: storeA } }), 2)
      assert.equal(await prisma.printJob.count({ where: { storeId: storeA, jobType: 'ORDER_ADDITION' } }), 1)

      await inStoreA(() =>
        waiter.cancelItem(
          sessionId,
          firstItem.id,
          { expectedVersion: 3, reason: 'Cliente mudou o pedido' },
          asWaiterA,
        ),
      )
      assert.equal(await prisma.printJob.count({ where: { storeId: storeA, jobType: 'ORDER_REMOVAL' } }), 1)
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: firstItem.productionOrderId! } })).status, 'cancelled')

      await prisma.order.update({
        where: { id: secondItem.productionOrderId! },
        data: { status: 'ready' },
      })
      await inStoreA(() =>
        waiter.deliverItem(sessionId, secondItem.id, { expectedVersion: 4 }, asWaiterA),
      )
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: secondItem.productionOrderId! } })).status, 'completed')
      assert.equal((await prisma.tableSessionItem.findUniqueOrThrow({ where: { id: secondItem.id } })).deliveredById, waiterA)

      await inStoreA(() =>
        waiter.requestClose(sessionId, { expectedVersion: 5 }, asWaiterA),
      )
      const closing = await prisma.tableSession.findUniqueOrThrow({ where: { id: sessionId } })
      assert.equal(closing.status, 'awaiting_close')
      assert.equal(closing.paymentMethod, null)
      assert.equal(closing.total.toNumber(), 31.5)
    } finally {
      await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } }).catch(() => undefined)
      await prisma.user.deleteMany({ where: { id: { in: [waiterA, waiterOther] } } }).catch(() => undefined)
      await prisma.$disconnect()
    }
  },
)

function authUser(id: string, storeId: string, name: string): AuthenticatedRequestUser {
  return {
    sub: id,
    email: `${id}@example.test`,
    name,
    storeId,
    role: 'waiter',
    permissions: [],
  }
}

function sendPayload(expectedVersion: number, productId: string) {
  return {
    expectedVersion,
    items: [{ productId, quantity: 1, notes: 'Teste integrado', options: [] }],
  }
}
