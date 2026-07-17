import type {
  CloseCashRegisterRequest,
  CloseCashRegisterResponse,
  GetCashRegisterResponse,
  OpenCashRegisterRequest,
  OpenCashRegisterResponse,
  RegisterCashMovementRequest,
  RegisterCashMovementResponse,
} from '@/contracts'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import { apiClient, shouldUseApi } from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { simulateAsync } from '@/services/utils'

export const cashRegisterService = {
  async getCurrentRegister(): Promise<GetCashRegisterResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetCashRegisterResponse>('/cash/register')
    }

    return simulateAsync({ data: getDemoDatabase().cash.currentRegister })
  },

  async openRegister(request: OpenCashRegisterRequest): Promise<OpenCashRegisterResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<OpenCashRegisterResponse, OpenCashRegisterRequest>(
        '/cash/register/open',
        request,
      )
      mockRealtimeBus.emit('cash.updated', { registerId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.cash.currentRegister.status = 'open'
      database.cash.currentRegister.openingAmount = request.openingAmount
      database.cash.currentRegister.expectedAmount = request.openingAmount
      database.cash.currentRegister.countedAmount = 0
      database.cash.currentRegister.differenceAmount = 0
      return database
    })

    mockRealtimeBus.emit('cash.updated', { registerId: nextDb.cash.currentRegister.id })
    return simulateAsync({ data: nextDb.cash.currentRegister })
  },

  async registerMovement(
    request: RegisterCashMovementRequest,
  ): Promise<RegisterCashMovementResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<
        RegisterCashMovementResponse,
        RegisterCashMovementRequest
      >('/cash/register/movement', request)
      mockRealtimeBus.emit('cash.updated', { registerId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.cash.currentRegister.movements.unshift({
        id: crypto.randomUUID(),
        type: request.type,
        amount: request.amount,
        label: request.label,
        method:
          request.type === 'sale' || request.type === 'refund' ? 'pix' : 'internal',
        createdAt: new Date().toISOString(),
        userName: 'Equipe',
      })

      if (request.type === 'supply') {
        database.cash.currentRegister.expectedAmount += request.amount
      }

      if (request.type === 'withdrawal' || request.type === 'refund') {
        database.cash.currentRegister.expectedAmount -= request.amount
      }

      return database
    })

    mockRealtimeBus.emit('cash.updated', { registerId: nextDb.cash.currentRegister.id })
    return simulateAsync({ data: nextDb.cash.currentRegister })
  },

  async closeRegister(
    request?: CloseCashRegisterRequest,
  ): Promise<CloseCashRegisterResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<
        CloseCashRegisterResponse,
        CloseCashRegisterRequest | undefined
      >('/cash/register/close', request)
      mockRealtimeBus.emit('cash.updated', { registerId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const counted = request?.countedAmount ?? database.cash.currentRegister.expectedAmount
      database.cash.currentRegister.status = 'closed'
      database.cash.currentRegister.countedAmount = counted
      database.cash.currentRegister.differenceAmount =
        counted - database.cash.currentRegister.expectedAmount
      return database
    })

    mockRealtimeBus.emit('cash.updated', { registerId: nextDb.cash.currentRegister.id })
    return simulateAsync({ data: nextDb.cash.currentRegister })
  },
}
