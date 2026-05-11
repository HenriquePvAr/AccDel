import { BadRequestException, Injectable } from '@nestjs/common'
import type { OrderStatus, Prisma } from '@prisma/client'

import type {
  KitchenQueueQuery,
  MarkKitchenOrderReadyPayload,
} from '@/contracts/kitchen.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapOrder } from '../orders/orders.mapper'

const kitchenStatuses: OrderStatus[] = ['in_preparation', 'ready']

@Injectable()
export class KitchenService {
  constructor(private readonly prisma: PrismaService) {}

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
    const production = mappedOrders.filter((order) => order.status === 'in_preparation')
    const ready = mappedOrders.filter((order) => order.status === 'ready')
    const urgent = production.filter((order) => this.isUrgent(order))

    return {
      data: {
        production,
        ready,
        urgent,
        all: mappedOrders,
        summary: {
          inProduction: production.length,
          ready: ready.length,
          urgent: urgent.length,
          delayed: mappedOrders.filter((order) => order.delayed).length,
          totalItems: mappedOrders.reduce(
            (sum, order) =>
              sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
            0,
          ),
        },
      },
    }
  }

  async markOrderReady(orderId: string, payload: MarkKitchenOrderReadyPayload) {
    const current = await this.prisma.order.findFirstOrThrow({
      where: {
        id: orderId,
        storeId: DEFAULT_STORE_ID,
      },
    })

    if (!['in_preparation', 'ready'].includes(current.status)) {
      throw new BadRequestException(
        'A cozinha so pode marcar como pronto pedidos em producao.',
      )
    }

    const order = await this.prisma.order.update({
      where: {
        id: current.id,
      },
      data: {
        status: 'ready',
        history:
          current.status === 'ready'
            ? undefined
            : {
                create: {
                  status: 'ready',
                  label: 'Pedido marcado como pronto pela cozinha',
                  actor: this.cleanDatabaseText(payload.actor ?? 'Cozinha'),
                },
              },
      },
      include: {
        items: true,
        history: true,
        driver: true,
      },
    })

    return {
      data: mapOrder(order),
    }
  }

  private buildWhere(query: KitchenQueueQuery): Prisma.OrderWhereInput {
    const now = new Date()

    return {
      storeId: DEFAULT_STORE_ID,
      status: {
        in: kitchenStatuses,
      },
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
    const prepTarget = order.estimatedPrepTimeMinutes ?? order.estimatedTotalTimeMinutes ?? 30
    const elapsedMinutes = this.getPreparationElapsedMinutes(order)

    return order.delayed || order.priority !== 'normal' || elapsedMinutes >= prepTarget * 0.8
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

  private cleanDatabaseText(value: string) {
    const safe = value
      .replace(/\uFFFD/g, '')
      .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '')
      .trim()

    return safe || 'Cozinha'
  }
}
