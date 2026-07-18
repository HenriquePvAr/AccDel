import { BadRequestException } from '@nestjs/common'

import type { CashMovementType, PaymentMethod } from '@prisma/client'

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

  if (input.type === 'CASH_SALE' || input.type === 'sale') {
    return input.method === 'cash' ? input.amount : 0
  }

  if (input.type === 'OPENING_BALANCE' || input.type === 'CASH_SUPPLY' || input.type === 'supply') {
    return input.amount
  }

  if (input.type === 'CASH_WITHDRAWAL' || input.type === 'CASH_REFUND' || input.type === 'withdrawal' || input.type === 'refund') {
    return -input.amount
  }

  if (input.type === 'CASH_ADJUSTMENT' || input.type === 'adjustment') {
    return input.adjustmentDirection === 'decrease' ? -input.amount : input.amount
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
  return movements.reduce((balance, movement) => balance + cashDelta(movement), openingAmount)
}

export function requiresDifferenceReason(differenceAmount: number) {
  return differenceAmount !== 0
}
