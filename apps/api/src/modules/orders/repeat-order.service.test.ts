import assert from 'node:assert/strict'
import test from 'node:test'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import type { PrismaService } from '@/shared/prisma/prisma.service'
import type { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { runWithStoreContext } from '@/shared/store-context'

import { OrdersService } from './orders.service'

const stopAfterCapture = new Error('stop-after-capture')
const printingPolicy = {
  createOrderJobs: async () => [],
  createOperationalJob: async () => null,
} as never
const actor: AuthenticatedRequestUser = {
  sub: 'manager-a',
  email: 'manager@example.test',
  name: 'Manager A',
  storeId: 'store-a',
  role: 'manager',
  permissions: ['orders:create'],
}

test('repeticao usa preco atual, zera pagamento/desconto e nao copia tracking', async () => {
  const fixture = buildFixture({ currentPrice: 25 })
  const service = new OrdersService(
    fixture.prisma,
    { emit: () => undefined } as unknown as AdminRealtimeService,
    printingPolicy,
  )

  await assert.rejects(
    () =>
      runWithStoreContext(
        { storeId: 'store-a', source: 'auth' },
        () => service.repeatOrder('old-order', { paymentMethod: 'cash' }, actor),
      ),
    stopAfterCapture,
  )

  const data = fixture.createdData
  assert.equal(data?.subtotal, 50)
  assert.equal(data?.total, 50)
  assert.equal(data?.paymentMethod, 'cash')
  assert.equal(data?.paymentStatus, 'pending')
  assert.equal(data?.discount, 0)
  assert.equal(data?.couponCode, null)
  assert.equal(data?.driverId, null)
  assert.equal(data?.status, 'in_analysis')
  assert.equal(data?.priority, 'normal')
  assert.equal(data?.notes, null)
  const itemCreate = (data?.items as { create: Array<Record<string, unknown>> }).create[0]
  assert.equal(itemCreate?.unitPrice, 25)
  assert.equal(itemCreate?.productId, 'product-a')
})

test('recalcula taxa de entrega pela zona atual e ignora promocao expirada', async () => {
  const fixture = buildFixture({
    currentPrice: 20,
    delivery: true,
    currentDeliveryFee: 12,
    expiredPromotion: true,
  })
  const service = new OrdersService(
    fixture.prisma,
    { emit: () => undefined } as unknown as AdminRealtimeService,
    printingPolicy,
  )

  await assert.rejects(
    () =>
      runWithStoreContext(
        { storeId: 'store-a', source: 'auth' },
        () => service.repeatOrder('old-order', { paymentMethod: 'pix' }, actor),
      ),
    stopAfterCapture,
  )

  assert.equal(fixture.createdData?.deliveryFee, 12)
  assert.equal(fixture.createdData?.discount, 0)
  assert.equal(fixture.createdData?.total, 52)
})

test('produto indisponivel retorna revisao estruturada e nao cria pedido', async () => {
  const fixture = buildFixture({ currentPrice: 25, productActive: false })
  const service = new OrdersService(
    fixture.prisma,
    { emit: () => undefined } as unknown as AdminRealtimeService,
    printingPolicy,
  )

  await assert.rejects(() =>
    runWithStoreContext(
      { storeId: 'store-a', source: 'auth' },
      () => service.repeatOrder('old-order', { paymentMethod: 'cash' }, actor),
    ),
  )
  assert.equal(fixture.createdData, undefined)
})

function buildFixture(options: {
  currentPrice: number
  productActive?: boolean
  delivery?: boolean
  currentDeliveryFee?: number
  expiredPromotion?: boolean
}) {
  let createdData: Record<string, unknown> | undefined
  const decimal = (value: number) => ({ toNumber: () => value })
  const serviceType = options.delivery ? 'delivery' : 'pickup'
  const current = {
    id: 'old-order',
    storeId: 'store-a',
    number: '#1001',
    customerId: options.delivery ? 'customer-a' : null,
    customerName: 'Customer A',
    customerPhone: '5592999999999',
    source: serviceType,
    serviceType,
    status: 'completed',
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    subtotal: decimal(10),
    deliveryFee: decimal(3),
    discount: decimal(5),
    total: decimal(8),
    couponCode: 'EXPIRED',
    promotionName: 'Old promotion',
    discountBreakdown: { old: true },
    dueAt: new Date('2025-01-01T00:00:00.000Z'),
    estimatedPrepTimeMinutes: 10,
    estimatedDeliveryTimeMinutes: 10,
    estimatedTotalTimeMinutes: 20,
    priority: 'vip',
    delayed: false,
    tags: ['historical'],
    addressLabel: options.delivery ? 'Home' : null,
    addressText: options.delivery ? 'Old address' : null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    tableCode: null,
    notes: 'Old sensitive note',
    driverId: 'old-driver',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    items: [
      {
        id: 'old-item',
        orderId: 'old-order',
        productId: 'product-a',
        name: 'Historical name',
        quantity: 2,
        unitPrice: decimal(5),
        notes: 'Old item note',
        options: [],
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ],
    customer: options.delivery
      ? {
          addresses: [
            { id: 'address-a', label: 'Home', district: 'Centro' },
          ],
        }
      : null,
  }
  const store = {
    id: 'store-a',
    defaultDeliveryFee: decimal(4),
    estimatedPrepTimeMinutes: 20,
    estimatedDeliveryTimeMinutes: 30,
    estimatedDineInTimeMinutes: 40,
    estimatedCounterTimeMinutes: 15,
    estimatedPickupTimeMinutes: 18,
  }
  const product = {
    id: 'product-a',
    storeId: 'store-a',
    categoryId: 'category-a',
    name: 'Current name',
    description: 'Current product',
    active: options.productActive !== false,
    price: decimal(options.currentPrice),
    availability: [
      {
        channel: options.delivery ? 'delivery' : 'counter',
        visible: true,
        available: true,
        soldOut: false,
        priceOverride: null,
      },
    ],
    optionGroups: [],
  }
  const expiredPromotion = {
    id: 'promotion-expired',
    channels: [],
    startsAt: null,
    endsAt: new Date('2025-01-01T00:00:00.000Z'),
  }
  const prisma = {
    order: {
      findFirstOrThrow: ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.storeId, 'store-a')
        return Promise.resolve(current)
      },
      count: () => Promise.resolve(1),
      create: ({ data }: { data: Record<string, unknown> }) => {
        createdData = data
        return Promise.reject(stopAfterCapture)
      },
    },
    store: { findUniqueOrThrow: () => Promise.resolve(store) },
    paymentMethodConfig: { findFirst: () => Promise.resolve({ id: 'payment-a' }) },
    product: { findMany: () => Promise.resolve([product]) },
    promotion: {
      findMany: () => Promise.resolve(options.expiredPromotion ? [expiredPromotion] : []),
    },
    deliveryZone: {
      findMany: () =>
        Promise.resolve(
          options.delivery
            ? [
                {
                  id: 'zone-a',
                  neighborhood: 'Centro',
                  active: true,
                  fee: decimal(options.currentDeliveryFee ?? 12),
                  estimatedDeliveryTimeMinutes: 25,
                },
              ]
            : [],
        ),
    },
  } as unknown as PrismaService

  return {
    prisma,
    get createdData() {
      return createdData
    },
  }
}
