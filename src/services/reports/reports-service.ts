import type { GetReportsRequest, GetReportsResponse } from '@/contracts'
import { waitersMock } from '@/mocks/waiters'
import { getDemoDatabase } from '@/services/adapters/demo-database'
import {
  apiClient,
  buildQueryString,
  shouldUseApi,
} from '@/services/http/api-client'
import { simulateAsync } from '@/services/utils'

import { buildReportsResponse, buildReportsSnapshot } from './reports-adapter'

export const reportsService = {
  async getSnapshot(request?: GetReportsRequest): Promise<GetReportsResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetReportsResponse>(
        `/reports/operational${buildQueryString(request?.filters ?? {})}`,
      )
    }

    const database = getDemoDatabase()
    const period = request?.filters?.period ?? 'today'
    const channel = request?.filters?.channel ?? 'all'
    const status = request?.filters?.status ?? 'all'
    const now = new Date()
    const cutoff = new Date(now)

    if (period === 'today') {
      cutoff.setHours(0, 0, 0, 0)
    }

    if (period === '7d') {
      cutoff.setDate(cutoff.getDate() - 7)
    }

    if (period === '30d') {
      cutoff.setDate(cutoff.getDate() - 30)
    }

    const filteredOrders = database.orders.filter((order) => {
      const createdAt = new Date(order.createdAt)
      const matchesPeriod = createdAt >= cutoff
      const matchesChannel = channel === 'all' || order.source === channel
      const matchesStatus = status === 'all' || order.status === status
      return matchesPeriod && matchesChannel && matchesStatus
    })

    const snapshot = buildReportsSnapshot({
      orders: filteredOrders,
      products: database.catalog.products,
      drivers: database.drivers.drivers,
      waiters: waitersMock,
    })

    return simulateAsync(buildReportsResponse(snapshot))
  },
}
