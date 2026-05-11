import type {
  Category,
  DiningTable,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  TableSession,
  TableSessionItem,
  User,
} from '@prisma/client'

import { mapDriver } from '@/modules/drivers/drivers.mapper'
import { mapWaiter } from '@/modules/waiters/waiters.mapper'

const channelLabelMap: Record<string, string> = {
  delivery: 'Delivery',
  dine_in: 'Salao',
  counter: 'Balcao',
  pickup: 'Retirada',
  digital_menu: 'Cardapio digital',
  whatsapp: 'WhatsApp',
}

const paymentLabelMap: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit_card: 'Credito',
  debit_card: 'Debito',
  cash: 'Dinheiro',
  meal_voucher: 'Vale refeicao',
  payment_link: 'Link de pagamento',
}

const statusLabelMap: Record<string, string> = {
  in_analysis: 'Em analise',
  in_preparation: 'Em preparo',
  ready: 'Pronto',
  out_for_delivery: 'Em rota',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
}

export function buildReportsSnapshot(args: {
  orders: Array<
    Order & {
      items: OrderItem[]
    }
  >
  products: Array<
    Product & {
      category: Category
    }
  >
  drivers: Parameters<typeof mapDriver>[0][]
  waiters: Parameters<typeof mapWaiter>[0][]
  diningTables: DiningTable[]
  diningSessions: Array<
    TableSession & {
      items: TableSessionItem[]
      table: DiningTable
      waiter: User | null
    }
  >
  period: 'today' | '7d' | '30d'
}) {
  const { orders, products, drivers, waiters, diningTables, diningSessions, period } = args
  const validOrders = orders.filter((order) => order.status !== 'cancelled')
  const closedDiningSessions = diningSessions.filter((session) => session.status === 'closed')
  const totalRevenue =
    validOrders.reduce((sum, order) => sum + order.total.toNumber(), 0) +
    closedDiningSessions.reduce((sum, session) => sum + session.total.toNumber(), 0)
  const billCount = validOrders.length + closedDiningSessions.length
  const averageTicket = billCount ? totalRevenue / billCount : 0
  const delayed = validOrders.filter((order) => order.delayed).length
  const revenueSeries = buildRevenueSeries(validOrders, closedDiningSessions, period)
  const byChannel = buildChannelBreakdown(validOrders, closedDiningSessions)
  const byPayment = buildPaymentBreakdown(validOrders, closedDiningSessions)
  const ordersByStatus = Object.entries(
    orders.reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.status] = (accumulator[order.status] ?? 0) + 1
      return accumulator
    }, {}),
  ).map(([status, count]) => ({
    id: status,
    label: statusLabelMap[status] ?? status,
    orders: count,
  }))

  const productMap = new Map(products.map((product) => [product.id, product]))
  const topProducts = buildTopRows(validOrders, closedDiningSessions, (item) => ({
    id: item.productId ?? item.name,
    label: item.name,
  }))
  const topCategories = buildTopRows(validOrders, closedDiningSessions, (item) => {
    const product = item.productId ? productMap.get(item.productId) : undefined
    return {
      id: product?.categoryId ?? 'uncategorized',
      label: product?.category.name ?? 'Sem categoria',
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
        trendDirection: 'up' as const,
      },
      {
        id: 'orders_count',
        label: 'Pedidos',
        value: String(billCount),
        trendLabel: `${delayed} atrasados no delivery/operacao`,
        trendDirection: delayed > 0 ? ('down' as const) : ('neutral' as const),
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
        trendDirection: 'up' as const,
      },
      {
        id: 'cancelled',
        label: 'Cancelados',
        value: String(orders.filter((order) => order.status === 'cancelled').length),
        trendLabel: 'Excecoes operacionais',
        trendDirection:
          orders.some((order) => order.status === 'cancelled')
            ? ('down' as const)
            : ('neutral' as const),
      },
    ],
    revenueSeries,
    byChannel,
    byPayment,
    ordersByStatus,
    topProducts,
    topCategories,
    cancellations: orders
      .filter((order) => order.status === 'cancelled')
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 8)
      .map((order) => ({
        id: order.id,
        orderNumber: order.number,
        customerName: order.customerName,
        note: order.notes ?? 'Sem observacao',
        value: order.total.toNumber(),
      })),
    driverSummaries: drivers
      .map((entry) => {
        const driver = mapDriver(entry)
        return {
          id: driver.id,
          name: driver.name,
          primary: `${driver.completedOrders ?? 0} concluidas`,
          secondary: `${driver.queue.length} em andamento`,
          value: driver.totalAssignedRevenue ?? 0,
        }
      })
      .sort((left, right) => right.value - left.value),
    waiterSummaries: waiters
      .map((entry) => {
        const waiter = mapWaiter(entry)
        return {
          id: waiter.id,
          name: waiter.name,
          primary: `${waiter.totalOrders} pedidos`,
          secondary: `${waiter.tablesServed} mesas`,
          value: waiter.totalSales,
        }
      })
      .sort((left, right) => right.value - left.value),
    tablesSummary: {
      free: diningTables.filter((table) => table.status === 'free').length,
      occupied: diningTables.filter((table) => table.status === 'occupied').length,
      reserved: diningTables.filter((table) => table.status === 'reserved').length,
      closing: diningTables.filter((table) => table.status === 'closing').length,
      openSessions: diningTables.filter((table) =>
        ['occupied', 'closing'].includes(table.status),
      ).length,
      closedSessions: closedDiningSessions.length,
      diningRevenue: Number(
        closedDiningSessions
          .reduce((sum, session) => sum + session.total.toNumber(), 0)
          .toFixed(2),
      ),
    },
  }
}

function buildRevenueSeries(
  orders: Array<Order & { items: OrderItem[] }>,
  diningSessions: Array<TableSession & { items: TableSessionItem[] }>,
  period: 'today' | '7d' | '30d',
) {
  const grouped = new Map<string, { revenue: number; orders: number }>()

  orders.forEach((order) => {
    const createdAt = order.createdAt
    const label =
      period === 'today'
        ? `${createdAt.getHours().toString().padStart(2, '0')}h`
        : `${createdAt.getDate().toString().padStart(2, '0')}/${(createdAt.getMonth() + 1)
            .toString()
            .padStart(2, '0')}`
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += order.total.toNumber()
    current.orders += 1
    grouped.set(label, current)
  })

  diningSessions.forEach((session) => {
    const baseDate = session.closedAt ?? session.openedAt
    const label =
      period === 'today'
        ? `${baseDate.getHours().toString().padStart(2, '0')}h`
        : `${baseDate.getDate().toString().padStart(2, '0')}/${(baseDate.getMonth() + 1)
            .toString()
            .padStart(2, '0')}`
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += session.total.toNumber()
    current.orders += 1
    grouped.set(label, current)
  })

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, row]) => ({
      label,
      revenue: Number(row.revenue.toFixed(2)),
      orders: row.orders,
      averageTicket: row.orders ? Number((row.revenue / row.orders).toFixed(2)) : 0,
    }))
}

function buildChannelBreakdown(
  orders: Order[],
  diningSessions: Array<TableSession & { items: TableSessionItem[] }>,
) {
  const grouped = new Map<string, { revenue: number; orders: number }>()

  orders.forEach((order) => {
    const label = channelLabelMap[order.source]
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += order.total.toNumber()
    current.orders += 1
    grouped.set(label, current)
  })

  diningSessions.forEach((session) => {
    const label = channelLabelMap.dine_in
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += session.total.toNumber()
    current.orders += 1
    grouped.set(label, current)
  })

  return Array.from(grouped.entries()).map(([label, row]) => ({
    label,
    revenue: Number(row.revenue.toFixed(2)),
    orders: row.orders,
  }))
}

function buildPaymentBreakdown(
  orders: Order[],
  diningSessions: Array<TableSession & { items: TableSessionItem[] }>,
) {
  const grouped = new Map<string, { revenue: number; orders: number }>()

  orders.forEach((order) => {
    const label = paymentLabelMap[order.paymentMethod]
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += order.total.toNumber()
    current.orders += 1
    grouped.set(label, current)
  })

  diningSessions.forEach((session) => {
    const label = paymentLabelMap[session.paymentMethod ?? 'cash']
    const current = grouped.get(label) ?? { revenue: 0, orders: 0 }
    current.revenue += session.total.toNumber()
    current.orders += 1
    grouped.set(label, current)
  })

  return Array.from(grouped.entries()).map(([label, row]) => ({
    label,
    revenue: Number(row.revenue.toFixed(2)),
    orders: row.orders,
  }))
}

function buildTopRows(
  orders: Array<Order & { items: OrderItem[] }>,
  diningSessions: Array<TableSession & { items: TableSessionItem[] }>,
  resolveGroup: (
    item: Pick<OrderItem, 'productId' | 'name' | 'quantity'> | Pick<TableSessionItem, 'productId' | 'name' | 'quantity'>,
  ) => { id: string; label: string },
) {
  const grouped = new Map<string, { id: string; label: string; revenue: number; orders: number }>()
  const totalRevenue =
    orders.reduce((sum, order) => sum + order.total.toNumber(), 0) +
    diningSessions.reduce((sum, session) => sum + session.total.toNumber(), 0)

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const group = resolveGroup(item)
      const current = grouped.get(group.id) ?? {
        id: group.id,
        label: group.label,
        revenue: 0,
        orders: 0,
      }
      current.revenue += item.unitPrice.toNumber() * item.quantity
      current.orders += item.quantity
      grouped.set(group.id, current)
    })
  })

  diningSessions.forEach((session) => {
    session.items.forEach((item) => {
      const group = resolveGroup(item)
      const current = grouped.get(group.id) ?? {
        id: group.id,
        label: group.label,
        revenue: 0,
        orders: 0,
      }
      current.revenue += item.totalPrice.toNumber()
      current.orders += item.quantity
      grouped.set(group.id, current)
    })
  })

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      revenue: Number(row.revenue.toFixed(2)),
      share: totalRevenue ? Math.round((row.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 8)
}
