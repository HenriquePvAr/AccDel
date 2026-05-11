import type { Prisma } from '@prisma/client'

import { toNumber } from '@/shared/mappers/number'

type CashRegisterWithMovements = Prisma.CashRegisterGetPayload<{
  include: {
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
    if (movement.type !== 'sale' || !movement.method) {
      continue
    }

    entriesByMethod[movement.method] += toNumber(movement.amount)
  }

  return {
    id: register.id,
    status: register.status,
    openedAt: register.openedAt.toISOString(),
    operatorName: register.operatorName,
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
        createdAt: movement.createdAt.toISOString(),
        userName: movement.userName,
      })),
  }
}
