import type { Prisma } from '@prisma/client'

import { toNumber } from '@/shared/mappers/number'

type CashRegisterWithMovements = Prisma.CashRegisterGetPayload<{
  include: {
    terminal: true
    movements: true
  }
}>

const paymentMethods = [
  'pix',
  'credit_card',
  'debit_card',
  'cash',
  'meal_voucher',
  'payment_link',
] as const

export function mapCashRegister(register: CashRegisterWithMovements) {
  const entriesByMethod = Object.fromEntries(paymentMethods.map((method) => [method, 0]))

  for (const movement of register.movements) {
    if (!isSaleMovement(movement.type) || !movement.method) {
      continue
    }

    entriesByMethod[movement.method] += toNumber(movement.amount)
  }

  return {
    id: register.id,
    status: register.status,
    openedAt: register.openedAt.toISOString(),
    closedAt: register.closedAt?.toISOString() ?? null,
    terminal: register.terminal
      ? {
          id: register.terminal.id,
          code: register.terminal.code,
          name: register.terminal.name,
        }
      : null,
    operatorName: register.operatorName,
    openedByName: register.openedByName ?? register.operatorName,
    closedByName: register.closedByName,
    openingNote: register.openingNote,
    closingNote: register.closingNote,
    differenceReason: register.differenceReason,
    openingAmount: toNumber(register.openingAmount),
    expectedAmount: toNumber(register.expectedAmount),
    countedAmount: toNumber(register.countedAmount),
    differenceAmount: toNumber(register.differenceAmount),
    entriesByMethod,
    movements: register.movements
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((movement) => ({
        id: movement.id,
        type: movement.type,
        method: movement.method ?? 'internal',
        amount: toNumber(movement.amount),
        label: movement.label,
        reason: movement.reason,
        balanceBefore: toNumber(movement.balanceBefore),
        balanceAfter: toNumber(movement.balanceAfter),
        originalMovementId: movement.originalMovementId,
        createdAt: movement.createdAt.toISOString(),
        userName: movement.operatorName ?? movement.userName,
        approvedByName: movement.approvedByName,
      })),
  }
}

function isSaleMovement(type: string) {
  return type === 'sale' || type === 'CASH_SALE'
}
