import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OrderTransitionError,
  resolveOrderTransition,
  type OrderTransitionContext,
} from './order-state-machine'

const base: OrderTransitionContext = {
  currentStatus: 'in_analysis',
  action: 'accept',
  source: 'delivery',
  paymentMethod: 'cash',
  paymentStatus: 'pending',
  assignedDriverId: null,
  actor: { userId: 'manager-a', role: 'manager' },
  dueAt: new Date('2026-07-14T20:00:00.000Z'),
}

test('permite apenas a sequencia operacional esperada', () => {
  assert.deepEqual(resolveOrderTransition(base), {
    nextStatus: 'in_preparation',
    idempotent: false,
  })
  assert.equal(
    resolveOrderTransition({ ...base, currentStatus: 'in_preparation', action: 'ready' })
      .nextStatus,
    'ready',
  )
  assert.equal(
    resolveOrderTransition({
      ...base,
      currentStatus: 'ready',
      action: 'dispatch',
      requestedDriverId: 'driver-a',
    }).nextStatus,
    'out_for_delivery',
  )
})

test('pedido de origem WhatsApp usa modalidade delivery para despacho', () => {
  assert.equal(
    resolveOrderTransition({
      ...base,
      source: 'whatsapp',
      serviceType: 'delivery',
      currentStatus: 'ready',
      action: 'dispatch',
      requestedDriverId: 'driver-a',
    }).nextStatus,
    'out_for_delivery',
  )
})

test('bloqueia salto arbitrario e atualizacao indevida de pedido concluido', () => {
  assertTransitionError(
    { ...base, action: 'ready' },
    'INVALID_ORDER_TRANSITION',
  )
  assertTransitionError(
    { ...base, currentStatus: 'completed', action: 'cancel' },
    'INVALID_ORDER_TRANSITION',
  )
})

test('motoboy A nao conclui entrega atribuida ao motoboy B', () => {
  assertTransitionError(
    {
      ...base,
      currentStatus: 'out_for_delivery',
      action: 'complete',
      assignedDriverId: 'driver-b',
      actor: { userId: 'driver-a', role: 'driver' },
    },
    'DRIVER_NOT_ASSIGNED',
  )
})

test('motoboy atribuido conclui a entrega e repeticao identica e idempotente', () => {
  assert.equal(
    resolveOrderTransition({
      ...base,
      currentStatus: 'out_for_delivery',
      action: 'complete',
      assignedDriverId: 'driver-a',
      actor: { userId: 'driver-a', role: 'driver' },
    }).nextStatus,
    'completed',
  )
  assert.equal(
    resolveOrderTransition({
      ...base,
      currentStatus: 'completed',
      action: 'complete',
      assignedDriverId: 'driver-a',
      actor: { userId: 'driver-a', role: 'driver' },
    }).idempotent,
    true,
  )
})

test('pagamento nao confirmado bloqueia despacho nao monetario', () => {
  assertTransitionError(
    {
      ...base,
      currentStatus: 'ready',
      action: 'dispatch',
      paymentMethod: 'credit_card',
      paymentStatus: 'pending',
      requestedDriverId: 'driver-a',
    },
    'PAYMENT_NOT_CONFIRMED',
  )
})

test('cancelamento em rota exige aprovacao gerencial', () => {
  assertTransitionError(
    {
      ...base,
      currentStatus: 'out_for_delivery',
      action: 'cancel',
      assignedDriverId: 'driver-a',
      actor: { userId: 'attendant-a', role: 'attendant' },
    },
    'CANCELLATION_REQUIRES_APPROVAL',
  )
})

function assertTransitionError(
  context: OrderTransitionContext,
  expectedCode: string,
) {
  assert.throws(
    () => resolveOrderTransition(context),
    (error) => error instanceof OrderTransitionError && error.code === expectedCode,
  )
}
