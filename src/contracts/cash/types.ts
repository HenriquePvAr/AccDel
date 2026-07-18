import type { CashMovement, CashMovementType, CashRegister, CashTerminal } from '@/types'

export interface GetCashRegisterResponse {
  data: CashRegister
}

export interface ListCashTerminalsResponse {
  data: CashTerminal[]
}

export interface ListCashRegistersResponse {
  data: CashRegister[]
}

export interface ListCashMovementsResponse {
  data: CashMovement[]
}

export interface OpenCashRegisterRequest {
  terminalId?: string
  openingAmount: number
  note?: string
}

export interface OpenCashRegisterResponse {
  data: CashRegister
}

export interface RegisterCashMovementRequest {
  type: CashMovementType
  amount: number
  label: string
  reason?: string
  originalMovementId?: string
}

export interface RegisterCashMovementResponse {
  data: CashRegister
}

export interface CloseCashRegisterRequest {
  countedAmount: number
  note?: string
  differenceReason?: string
}

export interface CloseCashRegisterResponse {
  data: CashRegister
}

export interface SupplyCashRegisterRequest {
  amount: number
  reason: string
}

export interface WithdrawCashRegisterRequest {
  amount: number
  reason: string
}

export interface CashRegisterHistoryFilters {
  status?: 'open' | 'closing' | 'closed' | 'all'
  terminalId?: string
  operator?: string
  difference?: 'all' | 'with' | 'without'
  from?: string
  to?: string
}

export interface AdjustCashMovementRequest {
  originalMovementId: string
  amount: number
  direction: 'increase' | 'decrease'
  reason: string
}
