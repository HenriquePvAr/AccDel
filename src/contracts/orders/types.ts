import type {
  Customer,
  Order,
  OrderChannel,
  OrderStatus,
  OrderTracking,
  PaymentMethod,
} from '@/types'

import type { ListResponse, PaginationParams } from '@/contracts/common'

export interface OrdersListFilters extends PaginationParams {
  search?: string
  source?: OrderChannel | 'all'
  status?: OrderStatus | 'all'
  paymentMethod?: PaymentMethod | 'all'
  delayedOnly?: boolean
}

export interface ListOrdersRequest {
  filters?: OrdersListFilters
}

export interface ListOrdersResponse extends ListResponse<Order> {
  summary: {
    totalOpen: number
    delayed: number
    ready: number
    routing: number
  }
}

export interface GetOrderByIdRequest {
  orderId: string
}

export interface GetOrderByIdResponse {
  data: Order | null
}

export type ListCustomersResponse = ListResponse<Customer>

export interface CreateOrderRequest {
  channel: OrderChannel
  customerId: string | null
  addressId?: string | null
  tableId?: string | null
  paymentMethod: PaymentMethod
  notes?: string
  sendToProduction: boolean
  items: Array<{
    productId: string
    quantity: number
  }>
}

export interface CreateOrderResponse {
  data: Order
}

export interface UpdateOrderStatusRequest {
  orderId: string
  action:
    | 'accept'
    | 'start_preparation'
    | 'ready'
    | 'dispatch'
    | 'complete'
    | 'cancel'
  actor?: string
  driverId?: string
}

export interface UpdateOrderStatusResponse {
  data: Order
}

export interface RepeatOrderRequest {
  orderId: string
}

export interface RepeatOrderResponse {
  data: Order
}

export interface GetOrderTrackingRequest {
  orderId: string
}

export interface GetOrderTrackingResponse {
  data: OrderTracking
}
