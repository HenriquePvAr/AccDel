import { Injectable } from '@nestjs/common'
import type { OrderStatus, Prisma } from '@prisma/client'

import type {
  KitchenQueueQuery,
  MarkKitchenOrderReadyPayload,
  MoveKitchenOrderPayload,
} from '@/contracts/kitchen.contract'
import { OrdersService } from '@/modules/orders/orders.service'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'

import { mapOrder } from '../orders/orders.mapper'

const activeKitchenStatuses: OrderStatus[] = [
  'in_analysis',
  'in_preparation',
  'ready',
  'out_for_delivery',
]

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async getQueue(query: KitchenQueueQuery) {
    const where = this.buildWhere(query)
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: true,
        history: true,
        driver: true,
      },
      orderBy: [
        {
          delayed: 'desc',
        },
        {
          dueAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    })

    const mappedOrders = orders.map(mapOrder)
    const received = mappedOrders.filter((order) => order.status === 'in_analysis')
    const production = mappedOrders.filter((order) => order.status === 'in_preparation')
    const ready = mappedOrders.filter((order) => order.status === 'ready')
    const dispatched = mappedOrders.filter((order) => order.status === 'out_for_delivery')
    const delivered = mappedOrders.filter((order) => order.status === 'completed')
    const urgent = mappedOrders.filter((order) => this.isUrgent(order))

    return {
      data: {
        received,
        production,
        ready,
        dispatched,
        delivered,
        urgent,
        all: mappedOrders,
        summary: {
          awaiting: received.length,
          inProduction: production.length,
          ready: ready.length,
          dispatched: dispatched.length,
          delivered: delivered.length,
          urgent: urgent.length,
          delayed: mappedOrders.filter((order) => order.delayed).length,
          totalItems: mappedOrders.reduce(
            (sum, order) =>
              sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
            0,
          ),
          averagePreparationMinutes: this.calculateAveragePreparationMinutes(mappedOrders),
        },
      },
    }
  }

  async markOrderReady(
    orderId: string,
    payload: MarkKitchenOrderReadyPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    void payload
    return this.ordersService.updateStatus(orderId, { action: 'ready' }, authUser)
  }

  async moveOrder(
    orderId: string,
    payload: MoveKitchenOrderPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    return this.ordersService.updateStatus(orderId, {
      action: payload.action,
      driverId: payload.driverId,
    }, authUser)
  }

  private buildWhere(query: KitchenQueueQuery): Prisma.OrderWhereInput {
    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      storeId: getCurrentStoreId(),
      OR: [
        {
          status: {
            in: activeKitchenStatuses,
          },
        },
        {
          status: 'completed',
          updatedAt: {
            gte: today,
          },
        },
      ],
      ...(query.channel && query.channel !== 'all' ? { source: query.channel } : {}),
      ...(query.priorityOnly
        ? {
            priority: {
              in: ['priority', 'vip'],
            },
          }
        : {}),
      ...(query.urgentOnly
        ? {
            OR: [
              {
                delayed: true,
              },
              {
                dueAt: {
                  lt: now,
                },
              },
              {
                priority: {
                  in: ['priority', 'vip'],
                },
              },
            ],
          }
        : {}),
    }
  }

  private isUrgent(order: ReturnType<typeof mapOrder>) {
    if (!['in_analysis', 'in_preparation'].includes(order.status)) {
      return false
    }

    const prepTarget = order.estimatedPrepTimeMinutes ?? order.estimatedTotalTimeMinutes ?? 30
    const elapsedMinutes = this.getPreparationElapsedMinutes(order)

    return order.delayed || order.priority !== 'normal' || elapsedMinutes >= prepTarget * 0.8
  }

  private calculateAveragePreparationMinutes(orders: ReturnType<typeof mapOrder>[]) {
    const durations = orders
      .map((order) => {
        const startedAt =
          order.timeline.find((entry) => entry.label.toLowerCase().includes('preparo'))?.at ??
          order.timeline.find((entry) => entry.label.toLowerCase().includes('producao'))?.at ??
          null
        const readyAt =
          order.timeline.find((entry) => entry.label.toLowerCase().includes('pronto'))?.at ??
          null

        if (!startedAt || !readyAt) {
          return null
        }

        const minutes = Math.round(
          (new Date(readyAt).getTime() - new Date(startedAt).getTime()) / 60000,
        )

        return minutes >= 0 ? minutes : null
      })
      .filter((value): value is number => value !== null)

    if (!durations.length) {
      return null
    }

    return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
  }

  private getPreparationElapsedMinutes(order: ReturnType<typeof mapOrder>) {
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

}
