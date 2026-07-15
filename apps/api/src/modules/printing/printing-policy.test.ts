import assert from 'node:assert/strict'
import test from 'node:test'

import { PrintingPolicyService } from './printing-policy.service'

const order = {
  id: 'order-a',
  number: '1042',
  createdAt: new Date('2026-07-14T20:00:00.000Z'),
  serviceType: 'delivery',
  tableCode: null,
  priority: 'normal',
  notes: 'Sem cebola',
  customerName: 'Cliente Ficticio',
  customerPhone: '5592999999999',
  addressText: 'Rua de Teste, 10',
  addressLabel: 'Casa',
  paymentMethod: 'cash',
  paymentStatus: 'pending',
  subtotal: 30,
  deliveryFee: 5,
  discount: 0,
  total: 35,
  driver: null,
}

test('regra de produto vence categoria e snapshot de cozinha nao contem dados financeiros', async () => {
  const createdJobs: Array<Record<string, unknown>> = []
  const kitchen = station('station-kitchen', 'COZINHA')
  const bar = station('station-bar', 'BAR')
  const tx = buildTransaction({
    createdJobs,
    stations: [kitchen, bar],
    products: [{ id: 'product-a', categoryId: 'category-a' }],
    rules: [
      {
        id: 'category-rule',
        scope: 'CATEGORY',
        productId: null,
        categoryId: 'category-a',
        stationId: kitchen.id,
        priority: 100,
        createdAt: new Date(),
        station: kitchen,
      },
      {
        id: 'product-rule',
        scope: 'PRODUCT',
        productId: 'product-a',
        categoryId: null,
        stationId: bar.id,
        priority: 0,
        createdAt: new Date(),
        station: bar,
      },
    ],
  })

  const service = new PrintingPolicyService()
  await service.createOrderJobs(tx as never, {
    storeId: 'store-a',
    eventId: 'event-a',
    jobType: 'ORDER_INITIAL',
    order,
    items: [
      {
        productId: 'product-a',
        name: 'Refrigerante',
        quantity: 2,
        unitPrice: 15,
        notes: null,
        options: [],
      },
    ],
  })

  assert.equal(createdJobs.length, 1)
  assert.equal(createdJobs[0]?.stationCode, 'BAR')
  assert.equal(createdJobs[0]?.templateKey, 'bar-order')
  const snapshot = createdJobs[0]?.payloadSnapshot as Record<string, unknown>
  assert.equal(snapshot.financial, undefined)
  assert.equal(snapshot.dispatch, undefined)
  assert.equal(JSON.stringify(snapshot).includes('5592999999999'), false)
  assert.equal((snapshot.items as unknown[]).length, 1)
})

test('fallback resolve item uma vez e bloqueio sem rota persiste falha operacional', async () => {
  const fallbackJobs: Array<Record<string, unknown>> = []
  const kitchen = station('station-kitchen', 'COZINHA')
  const fallbackTx = buildTransaction({
    createdJobs: fallbackJobs,
    stations: [kitchen],
    products: [],
    rules: [],
  })
  const service = new PrintingPolicyService()
  const item = {
    productId: null,
    name: 'Item legado',
    quantity: 1,
    unitPrice: 10,
    notes: null,
    options: [],
  }

  await service.createOrderJobs(fallbackTx as never, {
    storeId: 'store-a',
    eventId: 'event-fallback',
    jobType: 'ORDER_ADDITION',
    order,
    items: [item],
  })
  assert.equal(fallbackJobs.length, 1)
  assert.equal(fallbackJobs[0]?.stationId, kitchen.id)
  assert.equal(((fallbackJobs[0]?.payloadSnapshot as never) as { items: unknown[] }).items.length, 1)

  const blockedJobs: Array<Record<string, unknown>> = []
  const blockedTx = buildTransaction({
    createdJobs: blockedJobs,
    stations: [],
    products: [],
    rules: [],
    fallbackPolicy: 'BLOCK',
  })
  await service.createOrderJobs(blockedTx as never, {
    storeId: 'store-a',
    eventId: 'event-blocked',
    jobType: 'ORDER_INITIAL',
    order,
    items: [item],
  })
  assert.equal(blockedJobs[0]?.status, 'FAILED')
  assert.equal(blockedJobs[0]?.lastErrorCode, 'ROUTING_MISSING')
})

test('pagamento cria via interna e via do cliente somente quando configuradas', async () => {
  const createdJobs: Array<Record<string, unknown>> = []
  const cashier = station('station-cashier', 'CAIXA')
  const tx = buildTransaction({
    createdJobs,
    stations: [cashier],
    products: [],
    rules: [],
    printPaymentConfirmed: true,
    customerReceiptEnabled: true,
  })
  const service = new PrintingPolicyService()

  const jobIds = await service.createPaymentJobs(tx as never, {
    storeId: 'store-a',
    eventId: 'payment-event-a',
    order: { ...order, paymentStatus: 'paid' },
    items: [
      {
        productId: 'product-a',
        name: 'Hamburguer',
        quantity: 1,
        unitPrice: 30,
        notes: null,
        options: [],
      },
    ],
  })

  assert.equal(jobIds.length, 2)
  assert.deepEqual(
    createdJobs.map((job) => job.jobType),
    ['CASHIER_RECEIPT', 'CUSTOMER_RECEIPT'],
  )
  assert.deepEqual(
    createdJobs.map((job) => job.templateKey),
    ['cashier-receipt', 'customer-receipt'],
  )
  assert.notEqual(createdJobs[0]?.idempotencyKey, createdJobs[1]?.idempotencyKey)
})

function station(id: string, code: string) {
  return {
    id,
    storeId: 'store-a',
    code,
    name: code,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    printers: [
      {
        id: `printer-${id}`,
        storeId: 'store-a',
        stationId: id,
        agentId: 'agent-a',
        name: `Printer ${code}`,
        connectionType: 'FILE_OR_VIRTUAL',
        address: 'dry-run',
        port: null,
        paperWidth: 80,
        encoding: 'CP860',
        enabled: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }
}

function buildTransaction(input: {
  createdJobs: Array<Record<string, unknown>>
  stations: ReturnType<typeof station>[]
  products: Array<{ id: string; categoryId: string }>
  rules: Array<Record<string, unknown>>
  fallbackPolicy?: 'DEFAULT_STATION' | 'BLOCK'
  printPaymentConfirmed?: boolean
  customerReceiptEnabled?: boolean
}) {
  const fallback = input.stations.find((entry) => entry.code === 'COZINHA') ?? null
  return {
    printingSettings: {
      findUnique: async () => ({
        enabled: true,
        fallbackPolicy: input.fallbackPolicy ?? 'DEFAULT_STATION',
        fallbackStationId: fallback?.id ?? null,
        fallbackStation: fallback,
        printCancellation: true,
        printOrderReady: true,
        printPaymentConfirmed: input.printPaymentConfirmed ?? true,
        customerReceiptEnabled: input.customerReceiptEnabled ?? false,
        defaultMaxAttempts: 5,
      }),
    },
    product: { findMany: async () => input.products },
    printerRoutingRule: { findMany: async () => input.rules },
    printerStation: {
      findMany: async () => input.stations,
      findFirst: async (args: { where: { code: string } }) =>
        input.stations.find((entry) => entry.code === args.where.code) ?? null,
    },
    printTemplate: { findFirst: async () => null },
    printJob: {
      upsert: async (args: { create: Record<string, unknown> }) => {
        input.createdJobs.push(args.create)
        return args.create
      },
    },
    printAuditLog: { upsert: async () => ({}) },
  }
}
