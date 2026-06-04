import type { CashMovementType, CashRegister } from '@/types'

export interface GetCashRegisterResponse {
  data: CashRegister
}

export interface OpenCashRegisterRequest {
  openingAmount: number
}

export interface OpenCashRegisterResponse {
  data: CashRegister
}

export interface RegisterCashMovementRequest {
  type: CashMovementType
  amount: number
  label: string
}

export interface RegisterCashMovementResponse {
  data: CashRegister
}

export interface CloseCashRegisterRequest {
  countedAmount?: number
}

export interface CloseCashRegisterResponse {
  data: CashRegister
}
