import type {
  GetKitchenQueueRequest,
  GetKitchenQueueResponse,
  MarkKitchenOrderReadyRequest,
  MarkKitchenOrderReadyResponse,
} from '@/contracts'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import { apiClient, buildQueryString, shouldUseApi } from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { simulateAsync } from '@/services/utils'
import type { Order } from '@/types'

import { applyOrderStatusAction } from '../orders/order-adapter'

export const kitchenService = {
  async getQueue(request?: GetKitchenQueueRequest): Promise<GetKitchenQueueResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetKitchenQueueResponse>(
        `/kitchen/queue${buildQueryString(request?.filters ?? {})}`,
      )
    }

    const database = getDemoDatabase()
    return simulateAsync(buildKitchenQueueResponse(database.orders, request?.filters))
  },

  async markOrderReady(
    request: MarkKitchenOrderReadyRequest,
  ): Promise<MarkKitchenOrderReadyResponse> {
    if (shouldUseApi) {
      const response = await apiClient.patch<
        MarkKitchenOrderReadyResponse,
        Omit<MarkKitchenOrderReadyRequest, 'orderId'>
      >(`/kitchen/orders/${request.orderId}/ready`, {
        actor: request.actor,
      })
      mockRealtimeBus.emit('order.status_changed', {
        orderId: response.data.id,
        status: response.data.status,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.orders = database.orders.map((order) =>
        order.id === request.orderId
          ? applyOrderStatusAction(order, {
              orderId: request.orderId,
              action: 'ready',
              actor: request.actor ?? 'Cozinha',
            })
          : order,
      )
      return database
    })
    const updated = nextDb.orders.find((order) => order.id === request.orderId)!

    mockRealtimeBus.emit('order.status_changed', { orderId: updated.id, status: updated.status })
    return simulateAsync({ data: updated })
  },
}

function buildKitchenQueueResponse(
  orders: Order[],
  filters: GetKitchenQueueRequest['filters'] = {},
): GetKitchenQueueResponse {
  const filtered = orders.filter((order) => {
    const isKitchenOrder = ['in_preparation', 'ready'].includes(order.status)
    const matchesChannel =
      !filters?.channel || filters.channel === 'all' || order.source === filters.channel
    const isUrgent = getKitchenRisk(order) !== 'on_time'
    const isPriority = order.priority !== 'normal'

    return (
      isKitchenOrder &&
      matchesChannel &&
      (!filters?.urgentOnly || isUrgent) &&
      (!filters?.priorityOnly || isPriority)
    )
  })
  const production = filtered.filter((order) => order.status === 'in_preparation')
  const ready = filtered.filter((order) => order.status === 'ready')
  const urgent = production.filter((order) => getKitchenRisk(order) !== 'on_time')

  return {
    data: {
      production,
      ready,
      urgent,
      all: filtered,
      summary: {
        inProduction: production.length,
        ready: ready.length,
        urgent: urgent.length,
        delayed: filtered.filter((order) => order.delayed).length,
        totalItems: filtered.reduce(
          (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
          0,
        ),
      },
    },
  }
}

function getKitchenRisk(order: Order) {
  const targetMinutes = order.estimatedPrepTimeMinutes ?? order.estimatedTotalTimeMinutes ?? 30
  const elapsedMinutes = getElapsedPreparationMinutes(order)

  if (order.delayed || elapsedMinutes >= targetMinutes) {
    return 'late'
  }

  if (order.priority !== 'normal' || elapsedMinutes >= targetMinutes * 0.8) {
    return 'warning'
  }

  return 'on_time'
}

function getElapsedPreparationMinutes(order: Order) {
  const startedAt =
    order.timeline.find((entry) => {
      const label = entry.label.toLowerCase()
      return (
        label.includes('producao') ||
        label.includes('preparo') ||
        label.includes('aceito')
      )
    })?.at ?? order.createdAt

  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
}
