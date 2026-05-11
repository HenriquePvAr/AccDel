import type {
  GetWaiterByIdRequest,
  GetWaiterByIdResponse,
  ListWaitersResponse,
  SaveWaiterRequest,
  SaveWaiterResponse,
  UpdateWaiterStatusRequest,
  UpdateWaiterStatusResponse,
} from '@/contracts'
import { readStorage, writeStorage } from '@/lib/storage'
import { waitersMock } from '@/mocks/waiters'
import { ApiClientError, apiClient, shouldUseApi } from '@/services/http/api-client'
import { simulateAsync } from '@/services/utils'
import type { Waiter } from '@/types'

const STORAGE_KEY = 'cain-admin-waiters-db'

function getWaiters() {
  return readStorage<typeof waitersMock>(STORAGE_KEY) ?? structuredClone(waitersMock)
}

function saveWaiters(waiters: typeof waitersMock) {
  writeStorage(STORAGE_KEY, waiters)
  return waiters
}

export const waiterService = {
  async listWaiters(): Promise<ListWaitersResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListWaitersResponse>('/waiters')
    }

    const data = getWaiters()
    return simulateAsync({
      data,
      meta: {
        page: 1,
        pageSize: data.length,
        total: data.length,
        totalPages: 1,
      },
    })
  },

  async getWaiterById(request: GetWaiterByIdRequest): Promise<GetWaiterByIdResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetWaiterByIdResponse>(`/waiters/${request.waiterId}`)
    }

    const waiter = getWaiters().find((entry) => entry.id === request.waiterId)!
    return simulateAsync({ data: waiter })
  },

  async saveWaiter(request: SaveWaiterRequest): Promise<SaveWaiterResponse> {
    if (shouldUseApi) {
      if (request.waiter.id) {
        try {
          return await apiClient.patch<SaveWaiterResponse, SaveWaiterRequest>(
            `/waiters/${request.waiter.id}`,
            request,
          )
        } catch (error) {
          if (!(error instanceof ApiClientError) || error.status !== 404) {
            throw error
          }
        }
      }

      return apiClient.post<SaveWaiterResponse, SaveWaiterRequest>('/waiters', request)
    }

    const next = structuredClone(getWaiters())
    const index = next.findIndex((entry) => entry.id === request.waiter.id)
    const current = index >= 0 ? next[index] : null
    const waiter: Waiter = {
      id: request.waiter.id || crypto.randomUUID(),
      name: request.waiter.name,
      email: request.waiter.email,
      phone: request.waiter.phone,
      active: request.waiter.active,
      status: request.waiter.active ? request.waiter.status : 'paused',
      totalOrders: current?.totalOrders ?? 0,
      totalSales: current?.totalSales ?? 0,
      tablesServed: current?.tablesServed ?? 0,
      cancellations: current?.cancellations ?? 0,
      averageTicket: current?.averageTicket ?? 0,
      lastActivityAt: new Date().toISOString(),
      history: [
        {
          id: crypto.randomUUID(),
          label: current ? 'Cadastro atualizado no admin' : 'Cadastro criado no admin',
          createdAt: new Date().toISOString(),
        },
        ...(current?.history ?? []),
      ].slice(0, 8),
    }

    if (index >= 0) {
      next[index] = waiter
    } else {
      next.unshift(waiter)
    }

    saveWaiters(next)
    return simulateAsync({ data: waiter })
  },

  async updateWaiterStatus(
    request: UpdateWaiterStatusRequest,
  ): Promise<UpdateWaiterStatusResponse> {
    if (shouldUseApi) {
      return apiClient.patch<
        UpdateWaiterStatusResponse,
        Omit<UpdateWaiterStatusRequest, 'waiterId'>
      >(`/waiters/${request.waiterId}/status`, {
        active: request.active,
        status: request.status,
      })
    }

    const next = structuredClone(getWaiters())
    const index = next.findIndex((entry) => entry.id === request.waiterId)
    const current = next[index]
    const nextStatus = request.active ? (request.status ?? current?.status ?? 'available') : 'paused'

    if (current) {
      next[index] = {
        ...current,
        active: request.active,
        status: nextStatus,
        lastActivityAt: new Date().toISOString(),
        history: [
          {
            id: crypto.randomUUID(),
            label: request.active ? 'Acesso ativado' : 'Acesso desativado',
            createdAt: new Date().toISOString(),
          },
          ...current.history,
        ].slice(0, 8),
      }
    }

    saveWaiters(next)
    return simulateAsync({ data: next[index]! })
  },
}
