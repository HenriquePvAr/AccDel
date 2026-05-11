import type { DeliveryAssignment, DriverLocation, Order, StoreUser, User, DriverProfile } from '@prisma/client'

function buildConnectionStatus(lastActivityAt: Date | null, active: boolean) {
  if (!active || !lastActivityAt) {
    return 'offline' as const
  }

  return Date.now() - lastActivityAt.getTime() <= 30 * 60 * 1000 ? 'online' : 'offline'
}

export function mapDriver(params: {
  membership: StoreUser & {
    user: User
    driverProfile: DriverProfile | null
  }
  orders: Order[]
  assignments?: DeliveryAssignment[]
}) {
  const { membership, orders, assignments = [] } = params
  const profile = membership.driverProfile
  const assignmentByOrderId = new Map(assignments.map((assignment) => [assignment.orderId, assignment]))
  const activeOrders = orders
    .filter((order) => order.status === 'out_for_delivery')
    .sort((left, right) => {
      const leftSequence = assignmentByOrderId.get(left.id)?.finalSequence ?? Number.MAX_SAFE_INTEGER
      const rightSequence = assignmentByOrderId.get(right.id)?.finalSequence ?? Number.MAX_SAFE_INTEGER

      if (leftSequence !== rightSequence) {
        return leftSequence - rightSequence
      }

      return left.createdAt.getTime() - right.createdAt.getTime()
    })
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled')
  const averageDeliveryMinutes = completedOrders.length
    ? Math.round(
        completedOrders.reduce(
          (sum, order) => sum + (order.estimatedTotalTimeMinutes ?? 0),
          0,
        ) / completedOrders.length,
      )
    : 0
  const totalAssignedRevenue = completedOrders.reduce(
    (sum, order) => sum + order.total.toNumber(),
    0,
  )
  const queue = activeOrders.map((order, index) => ({
    id: assignmentByOrderId.get(order.id)?.id,
    orderId: order.id,
    orderNumber: order.number,
    customerName: order.customerName,
    addressLabel: order.addressLabel ?? order.addressText ?? 'Entrega',
    plannedSequence: index + 1,
    finalSequence: assignmentByOrderId.get(order.id)?.finalSequence ?? index + 1,
    actualSequence: assignmentByOrderId.get(order.id)?.actualSequence ?? undefined,
    etaMinutes: Math.max(
      5,
      Math.round((order.dueAt.getTime() - Date.now()) / (60 * 1000)),
    ),
    latitude: order.deliveryLatitude?.toNumber(),
    longitude: order.deliveryLongitude?.toNumber(),
  }))

  return {
    id: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone ?? '',
    vehicle: profile?.vehicle ?? 'Moto',
    active: membership.active && membership.user.status === 'active' && (profile?.active ?? true),
    connectionStatus: buildConnectionStatus(profile?.lastActivityAt ?? null, membership.active),
    availability: profile?.availability ?? 'available',
    currentOrderId: activeOrders[0]?.id,
    averageDeliveryMinutes,
    distanceKmToday: Number((completedOrders.length * 4.6).toFixed(1)),
    totalDeliveries: orders.length,
    completedOrders: completedOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalAssignedRevenue,
    lastActivityAt: profile?.lastActivityAt?.toISOString() ?? membership.updatedAt.toISOString(),
    queue,
    history: orders
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 8)
      .map((order) => ({
        id: order.id,
        orderNumber: order.number,
        status: order.status,
        total: order.total.toNumber(),
        createdAt: order.createdAt.toISOString(),
      })),
  }
}

export function mapDriverLocation(location: DriverLocation) {
  const storeLongitude = -60.0217
  const storeLatitude = -3.1019
  const longitude = location.longitude.toNumber()
  const latitude = location.latitude.toNumber()

  return {
    id: location.id,
    driverId: location.driverId,
    orderId: location.orderId ?? undefined,
    assignmentId: location.assignmentId ?? undefined,
    x: Math.round(50 + (longitude - storeLongitude) / 0.0012),
    y: Math.round(50 - (latitude - storeLatitude) / 0.0009),
    longitude,
    latitude,
    accuracyMeters: location.accuracyMeters?.toNumber(),
    heading: location.heading?.toNumber() ?? 0,
    speedKmh: location.speedKmh?.toNumber() ?? 0,
    capturedAt: location.capturedAt.toISOString(),
    source: location.source,
    isActive: location.isActive,
  }
}
