import type {
  CreateOrderRequest,
  ListCustomersResponse,
  ListOrdersRequest,
  ListOrdersResponse,
  UpdateOrderStatusRequest,
} from '@/contracts'
import { buildListResponse } from '@/services/adapters/list-response'
import { channelLabelMap } from '@/lib/domain'
import { getNextOrderNumber } from '@/services/adapters/demo-database'
import type { Customer, Order, OrderStatus, Product } from '@/types'

export function buildOrdersListResponse(
  orders: Order[],
  request?: ListOrdersRequest,
): ListOrdersResponse {
  const filters = request?.filters
  const search = filters?.search?.trim().toLowerCase()
  const filtered = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.number.toLowerCase().includes(search) ||
      order.customerName.toLowerCase().includes(search) ||
      order.customerPhone.toLowerCase().includes(search)

    const matchesSource = !filters?.source || filters.source === 'all' || order.source === filters.source
    const matchesStatus = !filters?.status || filters.status === 'all' || order.status === filters.status
    const matchesPayment =
      !filters?.paymentMethod ||
      filters.paymentMethod === 'all' ||
      order.paymentMethod === filters.paymentMethod
    const matchesDelayed = !filters?.delayedOnly || order.delayed

    return matchesSearch && matchesSource && matchesStatus && matchesPayment && matchesDelayed
  })

  const list = buildListResponse(filtered, filters)

  return {
    ...list,
    summary: {
      totalOpen: filtered.filter((order) => !['completed', 'cancelled'].includes(order.status)).length,
      delayed: filtered.filter((order) => order.delayed && order.status !== 'completed').length,
      ready: filtered.filter((order) => order.status === 'ready').length,
      routing: filtered.filter((order) => order.status === 'out_for_delivery').length,
    },
  }
}

export function buildCustomersResponse(customers: Customer[]): ListCustomersResponse {
  return buildListResponse(customers)
}

function buildTimelineEntry(label: string, actor: string) {
  return {
    id: crypto.randomUUID(),
    label,
    actor,
    at: new Date().toISOString(),
  }
}

export function buildOrderFromRequest(args: {
  request: CreateOrderRequest
  customers: Customer[]
  products: Product[]
  tableCode?: string
}): Order {
  const { request, customers, products, tableCode } = args
  const customer = customers.find((entry) => entry.id === request.customerId) ?? null
  const address = customer?.addresses.find((entry) => entry.id === request.addressId) ?? customer?.addresses[0]
  const items = request.items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId)

      if (!product) {
        return null
      }

      const options =
        product.optionGroups
          ?.flatMap((group) =>
            (item.options ?? [])
              .filter((option) => option.groupId === group.id)
              .map((option) => {
                const catalogOption = group.options.find((entry) => entry.id === option.optionId)

                return catalogOption
                  ? {
                      id: catalogOption.id,
                      groupId: group.id,
                      groupName: group.name,
                      name: catalogOption.name,
                      quantity: option.quantity,
                      price: catalogOption.priceDelta,
                    }
                  : null
              }),
          )
          .filter((option): option is NonNullable<typeof option> => Boolean(option)) ?? []
      const unitPrice =
        product.price + options.reduce((sum, option) => sum + option.price * option.quantity, 0)

      return {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        notes: item.notes,
        options,
      }
    })
    .filter(Boolean) as Order['items']

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const deliveryFee = request.channel === 'delivery' ? 8.5 : 0
  const createdAt = new Date().toISOString()
  const status: OrderStatus = request.sendToProduction ? 'in_preparation' : 'in_analysis'

  return {
    id: crypto.randomUUID(),
    number: '#PENDING',
    customerId: customer?.id ?? 'walk_in',
    customerName: customer?.name ?? 'Cliente sem cadastro',
    customerPhone: customer?.phone ?? '',
    source: request.channel,
    serviceType: request.channel,
    status,
    paymentMethod: request.paymentMethod,
    paymentStatus: request.paymentMethod === 'cash' ? 'pending' : 'paid',
    total: subtotal + deliveryFee,
    subtotal,
    deliveryFee,
    discount: 0,
    createdAt,
    dueAt: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    priority: 'normal',
    delayed: false,
    tags: [channelLabelMap[request.channel]],
    addressLabel: address?.label,
    addressText: address
      ? `${address.street}, ${address.number} - ${address.district}`
      : undefined,
    tableCode,
    notes: request.notes,
    items,
    timeline: [
      buildTimelineEntry('Pedido criado no admin', 'Equipe'),
      buildTimelineEntry(
        request.sendToProduction ? 'Enviado direto para preparo' : 'Mantido como novo',
        'Equipe',
      ),
    ],
  }
}

export function assignOrderNumber(orders: Order[], order: Order) {
  return {
    ...order,
    number: getNextOrderNumber(orders),
  }
}

export function applyOrderStatusAction(
  order: Order,
  request: UpdateOrderStatusRequest,
): Order {
  const actor = request.actor ?? 'Equipe'

  const timeline = [...order.timeline]
  let nextStatus = order.status

  switch (request.action) {
    case 'accept':
      timeline.push(buildTimelineEntry('Pedido aceito', actor))
      break
    case 'start_preparation':
      nextStatus = 'in_preparation'
      timeline.push(buildTimelineEntry('Preparo iniciado', actor))
      break
    case 'ready':
      nextStatus = 'ready'
      timeline.push(buildTimelineEntry('Pedido pronto', actor))
      break
    case 'dispatch':
      nextStatus = 'out_for_delivery'
      timeline.push(buildTimelineEntry('Saiu para entrega', actor))
      break
    case 'complete':
      nextStatus = 'completed'
      timeline.push(buildTimelineEntry('Pedido finalizado', actor))
      break
    case 'cancel':
      nextStatus = 'cancelled'
      timeline.push(buildTimelineEntry('Pedido cancelado', actor))
      break
  }

  return {
    ...order,
    status: nextStatus,
    tags:
      request.action === 'cancel' && !order.tags.includes('Cancelado')
        ? [...order.tags, 'Cancelado']
        : order.tags,
  }
}
