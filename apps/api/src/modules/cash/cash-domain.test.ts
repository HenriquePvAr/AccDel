import assert from 'node:assert/strict'
import test from 'node:test'

import { BadRequestException } from '@nestjs/common'

import {
  openCashRegisterSchema,
  supplyCashRegisterSchema,
  withdrawCashRegisterSchema,
} from '@/contracts/cash.contract'
import { confirmOrderPaymentSchema } from '@/contracts/orders.contract'

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

test('abertura aceita zero e rejeita valor negativo', () => {
  assert.equal(openCashRegisterSchema.safeParse({ openingAmount: 0 }).success, true)
  assert.equal(openCashRegisterSchema.safeParse({ openingAmount: -0.01 }).success, false)
})

test('adicao e retirada exigem valor positivo e motivo', () => {
  assert.equal(supplyCashRegisterSchema.safeParse({ amount: 10, reason: 'Troco' }).success, true)
  assert.equal(supplyCashRegisterSchema.safeParse({ amount: 0, reason: 'Troco' }).success, false)
  assert.equal(withdrawCashRegisterSchema.safeParse({ amount: 10, reason: '' }).success, false)
})

test('reembolso confirmado exige motivo explicito', () => {
  assert.equal(confirmOrderPaymentSchema.safeParse({ status: 'refunded' }).success, false)
  assert.equal(
    confirmOrderPaymentSchema.safeParse({ status: 'refunded', reason: 'Cliente desistiu' }).success,
    true,
  )
})

test('calculo monetario preserva centavos', () => {
  assert.equal(
    calculateExpectedCashBalance(0.1, [{ type: 'CASH_SUPPLY', amount: 0.2 }]),
    0.3,
  )
})
