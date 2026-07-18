import assert from 'node:assert/strict'
import test from 'node:test'

import { BadRequestException } from '@nestjs/common'

import { calculateExpectedCashBalance, cashDelta, requiresDifferenceReason } from './cash-domain'

test('calcula saldo esperado usando apenas dinheiro fisico', () => {
  const balance = calculateExpectedCashBalance(150, [
    { type: 'CASH_SALE', method: 'cash', amount: 80 },
    { type: 'CASH_SALE', method: 'pix', amount: 45 },
    { type: 'CASH_SUPPLY', amount: 50 },
    { type: 'CASH_WITHDRAWAL', amount: 30 },
    { type: 'CASH_REFUND', amount: 10 },
  ])

  assert.equal(balance, 240)
})

test('pix e cartao nao alteram saldo fisico', () => {
  assert.equal(cashDelta({ type: 'CASH_SALE', method: 'pix', amount: 45 }), 0)
  assert.equal(cashDelta({ type: 'CASH_SALE', method: 'credit_card', amount: 80 }), 0)
  assert.equal(cashDelta({ type: 'CASH_SALE', method: 'debit_card', amount: 30 }), 0)
})

test('retirada reembolso e ajuste negativo reduzem saldo', () => {
  assert.equal(cashDelta({ type: 'CASH_WITHDRAWAL', amount: 30 }), -30)
  assert.equal(cashDelta({ type: 'CASH_REFUND', amount: 10 }), -10)
  assert.equal(cashDelta({ type: 'CASH_ADJUSTMENT', amount: 5, adjustmentDirection: 'decrease' }), -5)
})

test('ajuste positivo e suprimento aumentam saldo', () => {
  assert.equal(cashDelta({ type: 'CASH_SUPPLY', amount: 50 }), 50)
  assert.equal(cashDelta({ type: 'CASH_ADJUSTMENT', amount: 5, adjustmentDirection: 'increase' }), 5)
})

test('valor negativo e rejeitado', () => {
  assert.throws(
    () => cashDelta({ type: 'CASH_SUPPLY', amount: -1 }),
    BadRequestException,
  )
})

test('diferenca de fechamento exige justificativa quando diferente de zero', () => {
  assert.equal(requiresDifferenceReason(0), false)
  assert.equal(requiresDifferenceReason(-5), true)
  assert.equal(requiresDifferenceReason(10), true)
})
