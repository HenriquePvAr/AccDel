import { cashRegisterMock } from '@/mocks'
import type { CashMovement, CashMovementType } from '@/types'
import { create } from 'zustand'

interface CashState {
  register: typeof cashRegisterMock
  addMovement: (type: CashMovementType, amount: number, label: string) => void
  closeRegister: () => void
}

const movementMethod: Record<CashMovementType, CashMovement['method']> = {
  sale: 'cash',
  withdrawal: 'internal',
  supply: 'internal',
  adjustment: 'internal',
  refund: 'cash',
  OPENING_BALANCE: 'cash',
  CASH_SALE: 'cash',
  CASH_SUPPLY: 'internal',
  CASH_WITHDRAWAL: 'internal',
  CASH_REFUND: 'cash',
  CASH_ADJUSTMENT: 'internal',
  CLOSING_DIFFERENCE: 'internal',
}

export const useCashStore = create<CashState>((set) => ({
  register: structuredClone(cashRegisterMock),
  addMovement: (type, amount, label) =>
    set((state) => ({
      register: {
        ...state.register,
        movements: [
          {
            id: crypto.randomUUID(),
            type,
            amount,
            label,
            method: movementMethod[type],
            createdAt: new Date().toISOString(),
            userName: 'Equipe',
          },
          ...state.register.movements,
        ],
      },
    })),
  closeRegister: () =>
    set((state) => ({
      register: {
        ...state.register,
        status: 'closed',
        countedAmount: state.register.expectedAmount,
        differenceAmount: 0,
      },
    })),
}))
