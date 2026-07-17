import assert from 'node:assert/strict'
import test from 'node:test'

import { confirmOrderPaymentSchema } from '@/contracts/orders.contract'

import { canTransitionPayment } from './payment-state-machine'

test('separa pagamento aguardando, confirmado, falho, cancelado e estornado', () => {
  assert.equal(canTransitionPayment('pending', 'paid'), true)
  assert.equal(canTransitionPayment('pending', 'failed'), true)
  assert.equal(canTransitionPayment('pending', 'cancelled'), true)
  assert.equal(canTransitionPayment('paid', 'refunded'), true)
  assert.equal(canTransitionPayment('refunded', 'paid'), false)
  assert.equal(canTransitionPayment('cancelled', 'paid'), false)
})

test('nao aceita paid true enviado pelo frontend', () => {
  assert.equal(confirmOrderPaymentSchema.safeParse({ paid: true }).success, false)
})
