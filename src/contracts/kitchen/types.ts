import type { Order, OrderChannel } from '@/types'

export interface KitchenQueueFilters {
  channel?: OrderChannel | 'all'
  urgentOnly?: boolean
  priorityOnly?: boolean
}

export interface KitchenQueueSummary {
  inProduction: number
  ready: number
  urgent: number
  delayed: number
  totalItems: number
}

export interface KitchenQueue {
  production: Order[]
  ready: Order[]
  urgent: Order[]
  all: Order[]
  summary: KitchenQueueSummary
}

export interface GetKitchenQueueRequest {
  filters?: KitchenQueueFilters
}

export interface GetKitchenQueueResponse {
  data: KitchenQueue
}

export interface MarkKitchenOrderReadyRequest {
  orderId: string
  actor?: string
}

export interface MarkKitchenOrderReadyResponse {
  data: Order
}
