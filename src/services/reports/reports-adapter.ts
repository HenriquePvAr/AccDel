import type { GetReportsResponse } from '@/contracts'
import type { Driver, Order, Product, ReportsSnapshot, Waiter } from '@/types'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'

export function buildReportsSnapshot(args: {
  orders: Order[]
  products: Product[]
  drivers?: Driver[]
  waiters?: Waiter[]
}): ReportsSnapshot {
  const { orders, products, drivers = [], waiters = [] } = args
  const validOrders = orders.filter((order) => order.status !== 'cancelled')
  const totalRevenue = validOrders.reduce((sum, order) => sum + order.total, 0)
  const averageTicket = validOrders.length ? totalRevenue / validOrders.length : 0
  const delayed = validOrders.filter((order) => order.delayed).length
  const revenueSeries = buildRevenueSeries(validOrders)
  const byChannel = buildBreakdown(validOrders, (order) => channelLabelMap[order.source])
  const byPayment = buildBreakdown(validOrders, (order) => paymentLabelMap[order.paymentMethod])
  const ordersByStatus = Object.entries(
    orders.reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.status] = (accumulator[order.status] ?? 0) + 1
      return accumulator
    }, {}),
  ).map(([status, count]) => ({
    id: status,
    label: status,
    orders: count,
  }))

  const productMap = new Map(products.map((product) => [product.id, product]))
  const topProducts = buildTopRows(validOrders, (item) => ({
    id: item.productId ?? item.name,
    label: item.name,
  }))
  const topCategories = buildTopRows(validOrders, (item) => {
    const product = item.productId ? productMap.get(item.productId) : undefined
    return {
      id: product?.categoryId ?? 'uncategorized',
      label: product?.categoryId ?? 'Sem categoria',
    }
  })

  return {
    metrics: [
      {
        id: 'gross_revenue',
        label: 'Faturamento bruto',
        value: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 0,
        }).format(totalRevenue),
        trendLabel: `${validOrders.length} pedidos validos`,
        trendDirection: 'up',
      },
      {
        id: 'orders_count',
        label: 'Pedidos',
        value: String(orders.length),
        trendLabel: `${delayed} atrasados`,
        trendDirection: delayed > 0 ? 'down' : 'neutral',
      },
      {
        id: 'average_ticket',
        label: 'Ticket medio',
        value: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 0,
        }).format(averageTicket),
        trendLabel: 'Base consolidada do periodo',
        trendDirection: 'up',
      },
      {
        id: 'cancelled',
        label: 'Cancelados',
        value: String(orders.filter((order) => order.status === 'cancelled').length),
        trendLabel: 'Excecoes operacionais',
        trendDirection: orders.some((order) => order.status === 'cancelled') ? 'down' : 'neutral',
      },
    ],
    revenueSeries,
    byChannel,
    byPayment,
    ordersByStatus,
    topProducts,
    topCategories,
    topOptions: [],
    topNeighborhoods: [],
    aiSummary: {
      orderDraftsSuggested: 0,
      orderDraftsConverted: 0,
      transfersToHuman: 0,
      conversionRate: 0,
    },
    timeSummary: {
      averagePreparationMinutes: null,
      averageDeliveryMinutes: null,
    },
    cancellations: orders
      .filter((order) => order.status === 'cancelled')
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 8)
      .map((order) => ({
        id: order.id,
        orderNumber: order.number,
        customerName: order.customerName,
        note: order.notes ?? 'Sem observacao',
        value: order.total,
      })),
    driverSummaries: drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      primary: `${driver.completedOrders ?? 0} concluidas`,
      secondary: `${driver.queue.length} em andamento`,
      value: driver.totalAssignedRevenue ?? 0,
    })),
    waiterSummaries: waiters.map((waiter) => ({
      id: waiter.id,
      name: waiter.name,
      primary: `${waiter.totalOrders} pedidos`,
      secondary: `${waiter.tablesServed} mesas`,
      value: waiter.totalSales,
    })),
    tablesSummary: {
      free: 0,
      occupied: 0,
      reserved: 0,
      closing: 0,
      openSessions: 0,
      closedSessions: 0,
      diningRevenue: 0,
    },
  }
}

function buildRevenueSeries(orders: Order[]) {
  const byHour = new Map<string, { revenue: number; orders: number }>()

  orders.forEach((order) => {
    const hourLabel = `${new Date(order.createdAt).getHours().toString().padStart(2, '0')}h`
    const hour = byHour.get(hourLabel) ?? { revenue: 0, orders: 0 }
    hour.revenue += order.total
    hour.orders += 1
    byHour.set(hourLabel, hour)
  })

  return [...byHour.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, row]) => ({
      label,
      revenue: row.revenue,
      orders: row.orders,
      averageTicket: row.orders ? Math.round(row.revenue / row.orders) : 0,
    }))
}

function buildBreakdown(orders: Order[], getLabel: (order: Order) => string) {
  const grouped = new Map<string, { revenue: number; orders: number }>()

  orders.forEach((order) => {
    const label = getLabel(order)
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += order.total
    current.orders += 1
    grouped.set(label, current)
  })

  return [...grouped.entries()].map(([label, row]) => ({
    label,
    revenue: row.revenue,
    orders: row.orders,
  }))
}

function buildTopRows(
  orders: Order[],
  resolveGroup: (item: Order['items'][number]) => { id: string; label: string },
) {
  const grouped = new Map<string, { id: string; label: string; revenue: number; orders: number }>()
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const group = resolveGroup(item)
      const current = grouped.get(group.id) ?? {
        id: group.id,
        label: group.label,
        revenue: 0,
        orders: 0,
      }
      current.revenue += item.unitPrice * item.quantity
      current.orders += item.quantity
      grouped.set(group.id, current)
    })
  })

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      share: totalRevenue ? Math.round((row.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 8)
}

export function buildReportsResponse(snapshot: ReportsSnapshot): GetReportsResponse {
  return {
    data: snapshot,
  }
}
