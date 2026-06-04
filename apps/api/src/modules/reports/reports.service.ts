import { Injectable } from '@nestjs/common'

import type { OperationalReportsQuery } from '@/contracts/reports.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { buildReportsSnapshot } from './reports.mapper'

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalSnapshot(query: OperationalReportsQuery) {
    const period = query.period ?? 'today'
    const cutoff = buildPeriodCutoff(period)
    const orderWhere = {
      storeId: getCurrentStoreId(),
      createdAt: {
        gte: cutoff,
      },
      ...(query.channel && query.channel !== 'all' ? { source: query.channel } : {}),
      ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
    }

    const includeDiningChannel =
      !query.channel || query.channel === 'all' || query.channel === 'dine_in'
    const includeDiningSalesStatus =
      !query.status || query.status === 'all' || query.status === 'completed'

    const [
      orders,
      products,
      drivers,
      waiters,
      diningTables,
      diningSessions,
      aiOrderDrafts,
      aiTransfersToHuman,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        include: {
          items: true,
          history: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.product.findMany({
        where: {
          storeId: getCurrentStoreId(),
        },
        include: {
          category: true,
        },
      }),
      this.prisma.storeUser.findMany({
        where: {
          storeId: getCurrentStoreId(),
          role: 'driver',
        },
        include: {
          user: true,
          driverProfile: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }).then(async (memberships) => {
        const driverOrders = await this.prisma.order.findMany({
          where: {
            storeId: getCurrentStoreId(),
            createdAt: {
              gte: cutoff,
            },
            ...(query.channel && query.channel !== 'all' ? { source: query.channel } : {}),
            ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
            driverId: {
              in: memberships.map((membership) => membership.userId),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        return memberships.map((membership) => ({
          membership,
          orders: driverOrders.filter((order) => order.driverId === membership.userId),
        }))
      }),
      this.prisma.storeUser.findMany({
        where: {
          storeId: getCurrentStoreId(),
          role: 'waiter',
        },
        include: {
          user: true,
          waiterProfile: {
            include: {
              history: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 8,
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }).then((memberships) => memberships.map((membership) => ({ membership }))),
      this.prisma.diningTable.findMany({
        where: {
          storeId: getCurrentStoreId(),
        },
      }),
      includeDiningChannel
        ? this.prisma.tableSession.findMany({
            where: {
              storeId: getCurrentStoreId(),
              ...(includeDiningSalesStatus
                ? {
                    OR: [
                      {
                        openedAt: {
                          gte: cutoff,
                        },
                      },
                      {
                        closedAt: {
                          gte: cutoff,
                        },
                      },
                    ],
                  }
                : {
                    status: 'open',
                    openedAt: {
                      gte: cutoff,
                    },
                  }),
            },
            include: {
              items: true,
              table: true,
              waiter: true,
            },
            orderBy: {
              openedAt: 'desc',
            },
          })
        : Promise.resolve([]),
      this.prisma.aiOrderDraft.findMany({
        where: {
          conversation: {
            storeId: getCurrentStoreId(),
          },
          createdAt: {
            gte: cutoff,
          },
        },
        select: {
          id: true,
          status: true,
          convertedOrderId: true,
          createdAt: true,
        },
      }),
      this.prisma.whatsappIntegrationLog.count({
        where: {
          storeId: getCurrentStoreId(),
          type: 'human_assigned',
          createdAt: {
            gte: cutoff,
          },
        },
      }),
    ])

    return {
      data: buildReportsSnapshot({
        orders,
        products,
        drivers,
        waiters,
        diningTables,
        diningSessions,
        aiOrderDrafts,
        aiTransfersToHuman,
        period,
      }),
    }
  }
}

function buildPeriodCutoff(period: 'today' | '7d' | '30d') {
  const cutoff = new Date()

  if (period === 'today') {
    cutoff.setHours(0, 0, 0, 0)
    return cutoff
  }

  if (period === '7d') {
    cutoff.setDate(cutoff.getDate() - 7)
    return cutoff
  }

  cutoff.setDate(cutoff.getDate() - 30)
  return cutoff
}
