import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CreatePublicOrderRequest,
  CreatePublicOrderResponse,
  GetOrderByIdRequest,
  GetOrderByIdResponse,
  GetOrderTrackingRequest,
  GetOrderTrackingResponse,
  ListCustomersResponse,
  ListOrdersRequest,
  ListOrdersResponse,
  RepeatOrderRequest,
  RepeatOrderResponse,
  UpdateOrderStatusRequest,
  UpdateOrderStatusResponse,
} from '@/contracts'
import { mutateDemoDatabase, getDemoDatabase } from '@/services/adapters/demo-database'
import {
  ApiClientError,
  apiClient,
  buildQueryString,
  shouldUseApi,
} from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { simulateAsync } from '@/services/utils'

import {
  applyOrderStatusAction,
  assignOrderNumber,
  buildCustomersResponse,
  buildOrderFromRequest,
  buildOrdersListResponse,
} from './order-adapter'

export const orderService = {
  async listOrders(request?: ListOrdersRequest): Promise<ListOrdersResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListOrdersResponse>(
        `/orders${buildQueryString(request?.filters ?? {})}`,
      )
    }

    const database = getDemoDatabase()
    return simulateAsync(buildOrdersListResponse(database.orders, request))
  },

  async getOrderById(request: GetOrderByIdRequest): Promise<GetOrderByIdResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetOrderByIdResponse>(`/orders/${request.orderId}`)
    }

    const database = getDemoDatabase()
    return simulateAsync({
      data: database.orders.find((order) => order.id === request.orderId) ?? null,
    })
  },

  async getOrderTracking(request: GetOrderTrackingRequest): Promise<GetOrderTrackingResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetOrderTrackingResponse>(`/orders/${request.orderId}/tracking`, {
        skipAuth: true,
      })
    }

    const order = getDemoDatabase().orders.find((entry) => entry.id === request.orderId)

    return simulateAsync({
      data: {
        orderId: request.orderId,
        orderNumber: order?.number ?? '',
        status: order?.status ?? 'in_analysis',
        message: order?.status === 'out_for_delivery' ? 'Motoboy a caminho do seu pedido' : 'Pedido em acompanhamento.',
        etaMinutes: Math.max(
          1,
          Math.round(
            ((order ? new Date(order.dueAt).getTime() : Date.now()) - Date.now()) / 60000,
          ),
        ),
        provider: 'fallback',
        driver: null,
        driverLocation: null,
        updatedAt: new Date().toISOString(),
      },
    })
  },

  async listCustomers(): Promise<ListCustomersResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListCustomersResponse>('/customers')
    }

    const database = getDemoDatabase()
    return simulateAsync(buildCustomersResponse(database.customers))
  },

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<CreateOrderResponse, CreateOrderRequest>(
        '/orders',
        request,
      )
      mockRealtimeBus.emit('order.created', { orderId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const table = request.tableId
        ? database.dining.tables.find((entry) => entry.id === request.tableId)
        : null
      let sessionId = table?.currentSessionId

      if (request.channel === 'dine_in' && table && !sessionId) {
        sessionId = crypto.randomUUID()
        database.dining.sessions.unshift({
          id: sessionId,
          tableId: table.id,
          tableCode: table.code,
          openedAt: new Date().toISOString(),
          guestCount: 2,
          subtotal: 0,
          discount: 0,
          serviceFee: 0,
          total: 0,
          status: 'open',
          timeline: [
            {
              id: crypto.randomUUID(),
              label: `Mesa ${table.code} aberta a partir do lancamento manual`,
              actor: 'Operacao',
              at: new Date().toISOString(),
            },
          ],
          items: [],
        })
        table.currentSessionId = sessionId
        table.status = 'occupied'
        table.guests = 2
      }

      const built = buildOrderFromRequest({
        request,
        customers: database.customers,
        products: database.catalog.products,
        tableCode: table ? `Mesa ${table.code}` : undefined,
      })
      const order = assignOrderNumber(database.orders, built)

      database.orders.unshift(order)

      if (sessionId) {
        const session = database.dining.sessions.find((entry) => entry.id === sessionId)
        if (session) {
          session.items.push(
            ...order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              notes: item.notes,
              options: item.options,
            })),
          )
          session.subtotal = session.items.reduce((sum, item) => sum + item.totalPrice, 0)
          session.serviceFee = session.subtotal * 0.1
          session.total = session.subtotal - session.discount + session.serviceFee
          session.timeline.push({
            id: crypto.randomUUID(),
            label: `Pedido ${order.number} vinculado a mesa`,
            actor: 'Operacao',
            at: new Date().toISOString(),
          })
        }
      }

      return database
    })

    mockRealtimeBus.emit('order.created', { orderId: nextDb.orders[0].id })

    return simulateAsync({ data: nextDb.orders[0] })
  },

  async createPublicOrder(
    request: CreatePublicOrderRequest,
  ): Promise<CreatePublicOrderResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<CreatePublicOrderResponse, CreatePublicOrderRequest>(
        '/public/orders',
        request,
        { skipAuth: true },
      )
      mockRealtimeBus.emit('order.created', { orderId: response.data.id })
      return response
    }

    throw new ApiClientError('Checkout publico exige API real para validar catalogo e criar pedido.', 400)
  },

  async updateOrderStatus(request: UpdateOrderStatusRequest): Promise<UpdateOrderStatusResponse> {
    if (shouldUseApi) {
      const response = await apiClient.patch<
        UpdateOrderStatusResponse,
        Omit<UpdateOrderStatusRequest, 'orderId'>
      >(`/orders/${request.orderId}/status`, {
        action: request.action,
        actor: request.actor,
        driverId: request.driverId,
      })
      mockRealtimeBus.emit('order.status_changed', {
        orderId: response.data.id,
        status: response.data.status,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.orders = database.orders.map((order) =>
        order.id === request.orderId ? applyOrderStatusAction(order, request) : order,
      )
      return database
    })

    const updated = nextDb.orders.find((order) => order.id === request.orderId)!
    mockRealtimeBus.emit('order.status_changed', { orderId: updated.id, status: updated.status })

    return simulateAsync({ data: updated })
  },

  async repeatOrder(request: RepeatOrderRequest): Promise<RepeatOrderResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<RepeatOrderResponse>(
        `/orders/${request.orderId}/repeat`,
      )
      mockRealtimeBus.emit('order.created', { orderId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const order = database.orders.find((entry) => entry.id === request.orderId)
      if (!order) {
        return database
      }

      const duplicated = assignOrderNumber(database.orders, {
        ...structuredClone(order),
        id: crypto.randomUUID(),
        status: 'in_analysis',
        delayed: false,
        createdAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
        timeline: [
          {
            id: crypto.randomUUID(),
            label: 'Pedido recriado a partir do histórico',
            actor: 'Operação',
            at: new Date().toISOString(),
          },
        ],
      })

      database.orders.unshift(duplicated)
      return database
    })

    mockRealtimeBus.emit('order.created', { orderId: nextDb.orders[0].id })
    return simulateAsync({ data: nextDb.orders[0] })
  },
}
