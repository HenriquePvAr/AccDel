import type { Prisma } from '@prisma/client'

import { toNumber } from '@/shared/mappers/number'

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true
    history: true
    driver: true
  }
}>

export function mapOrder(order: OrderWithRelations) {
  const delayed =
    order.delayed ||
    (new Date(order.dueAt).getTime() < Date.now() &&
      !['completed', 'cancelled'].includes(order.status))

  return {
    id: order.id,
    number: order.number,
    customerId: order.customerId ?? 'walk_in',
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    source: order.source,
    serviceType: order.serviceType,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: toNumber(order.total),
    subtotal: toNumber(order.subtotal),
    deliveryFee: toNumber(order.deliveryFee),
    discount: toNumber(order.discount),
    couponCode: order.couponCode ?? undefined,
    promotionName: order.promotionName ?? undefined,
    discountBreakdown: order.discountBreakdown ?? undefined,
    createdAt: order.createdAt.toISOString(),
    dueAt: order.dueAt.toISOString(),
    estimatedPrepTimeMinutes: order.estimatedPrepTimeMinutes ?? undefined,
    estimatedDeliveryTimeMinutes: order.estimatedDeliveryTimeMinutes ?? undefined,
    estimatedTotalTimeMinutes: order.estimatedTotalTimeMinutes ?? undefined,
    priority: order.priority,
    delayed,
    tags: order.tags,
    addressLabel: order.addressLabel ?? undefined,
    addressText: order.addressText ?? undefined,
    tableCode: order.tableCode ?? undefined,
    notes: order.notes ?? undefined,
    driverId: order.driverId ?? undefined,
    driver: order.driver
      ? {
          id: order.driver.id,
          name: order.driver.name,
          phone: order.driver.phone ?? '',
        }
      : undefined,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? '',
      name: item.name,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      notes: item.notes ?? undefined,
      options: Array.isArray(item.options) ? item.options : [],
      cancelledAt: item.cancelledAt?.toISOString(),
      cancelReason: item.cancelReason ?? undefined,
    })),
    timeline: order.history
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        actor: entry.actor,
        at: entry.createdAt.toISOString(),
      })),
  }
}
