import { BadRequestException } from '@nestjs/common'

import { Prisma, type CashMovementType, type PaymentMethod } from '@prisma/client'

export const physicalCashMovementTypes = new Set<CashMovementType>([
  'OPENING_BALANCE',
  'CASH_SALE',
  'CASH_SUPPLY',
  'CASH_WITHDRAWAL',
  'CASH_REFUND',
  'CASH_ADJUSTMENT',
  'CLOSING_DIFFERENCE',
  'sale',
  'supply',
  'withdrawal',
  'refund',
  'adjustment',
])

export function cashDelta(input: {
  type: CashMovementType
  amount: number
  method?: PaymentMethod | null
  adjustmentDirection?: 'increase' | 'decrease'
}) {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new BadRequestException('Valor monetario invalido.')
  }

  return cashDeltaSign(input) * input.amount
}

export function cashDeltaSign(input: {
  type: CashMovementType
  method?: PaymentMethod | null
  adjustmentDirection?: 'increase' | 'decrease'
}) {

  if (input.type === 'CASH_SALE' || input.type === 'sale') {
    return input.method === 'cash' ? 1 : 0
  }

  if (input.type === 'OPENING_BALANCE' || input.type === 'CASH_SUPPLY' || input.type === 'supply') {
    return 1
  }

  if (input.type === 'CASH_WITHDRAWAL' || input.type === 'CASH_REFUND' || input.type === 'withdrawal' || input.type === 'refund') {
    return -1
  }

  if (input.type === 'CASH_ADJUSTMENT' || input.type === 'adjustment') {
    return input.adjustmentDirection === 'decrease' ? -1 : 1
  }

  return 0
}

export function calculateExpectedCashBalance(
  openingAmount: number,
  movements: Array<{
    type: CashMovementType
    amount: number
    method?: PaymentMethod | null
    adjustmentDirection?: 'increase' | 'decrease'
  }>,
) {
  return movements
    .reduce(
      (balance, movement) => balance.plus(cashDelta(movement)),
      new Prisma.Decimal(openingAmount),
    )
    .toDecimalPlaces(2)
    .toNumber()
}

export function requiresDifferenceReason(differenceAmount: number) {
  return differenceAmount !== 0
}
