import type { Order, OrderChannel } from '@/types'

export interface KitchenQueueFilters {
  channel?: OrderChannel | 'all'
  urgentOnly?: boolean
  priorityOnly?: boolean
}

export interface KitchenQueueSummary {
  awaiting: number
  inProduction: number
  ready: number
  dispatched: number
  delivered: number
  urgent: number
  delayed: number
  totalItems: number
  averagePreparationMinutes: number | null
}

export interface KitchenQueue {
  received: Order[]
  production: Order[]
  ready: Order[]
  dispatched: Order[]
  delivered: Order[]
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

export interface MoveKitchenOrderRequest {
  orderId: string
  action: 'accept' | 'start_preparation' | 'ready' | 'dispatch' | 'complete'
  actor?: string
  driverId?: string
}

export interface MoveKitchenOrderResponse {
  data: Order
}
