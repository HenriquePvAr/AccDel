import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import type {
  WaiterCancelItemPayload,
  WaiterExpectedVersionPayload,
  WaiterOpenSessionPayload,
  WaiterSendItemsPayload,
  WaiterTransferSessionPayload,
} from '@/contracts/waiter.contract'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { CatalogService } from '@/modules/catalog/catalog.service'
import { DiningService } from '@/modules/dining/dining.service'
import { PrintingPolicyService } from '@/modules/printing/printing-policy.service'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { getCurrentStoreId } from '@/shared/store-context'

@Injectable()
export class WaiterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dining: DiningService,
    private readonly catalog: CatalogService,
    private readonly printingPolicy: PrintingPolicyService,
    private readonly realtime: AdminRealtimeService,
  ) {}

  async getBootstrap(authUser: AuthenticatedRequestUser) {
    const [profile, tables, menu] = await Promise.all([
      this.getProfile(authUser),
      this.dining.listTables(),
      this.getMenu(),
    ])

    return {
      data: {
        profile: profile.data,
        room: tables.data,
        menu: menu.data,
      },
    }
  }

  async getProfile(authUser: AuthenticatedRequestUser) {
    const membership = await this.prisma.storeUser.findFirstOrThrow({
      where: {
        storeId: getCurrentStoreId(),
        userId: authUser.sub,
        active: true,
      },
      include: {
        store: {
          select: {
            id: true,
            tradeName: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        waiterProfile: {
          select: {
            status: true,
            tablesServed: true,
            totalOrders: true,
            lastActivityAt: true,
          },
        },
      },
    })

    return {
      data: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        operationalStatus: membership.waiterProfile?.status ?? 'available',
        tablesServed: membership.waiterProfile?.tablesServed ?? 0,
        totalOrders: membership.waiterProfile?.totalOrders ?? 0,
        lastActivityAt: membership.waiterProfile?.lastActivityAt?.toISOString(),
        store: membership.store,
      },
    }
  }

  listTables() {
    return this.dining.listTables()
  }

  getTable(tableId: string) {
    return this.dining.getTableById(tableId)
  }

  async getMenu() {
    const source = await this.catalog.getMenuSource({
      channel: 'dine_in',
      includeUnavailable: true,
    })

    return {
      data: {
        generatedAt: source.data.generatedAt,
        store: {
          id: source.data.store.id,
          name: source.data.store.tradeName || source.data.store.name,
        },
        categories: source.data.categories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          color: category.color,
          sortOrder: category.sortOrder,
          available: category.visibleForChannel,
          products: category.products.map((product) => ({
            id: product.id,
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            price: product.price,
            image: product.image,
            featured: product.featured,
            orderable: product.orderable,
            unavailableReason: product.unavailableReason,
            optionGroups: product.optionGroups.map((group) => ({
              id: group.id,
              name: group.name,
              description: group.description,
              required: group.required,
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              options: group.options.map((option) => ({
                id: option.id,
                name: option.name,
                description: option.description,
                priceDelta: option.priceDelta,
                orderable: option.orderable,
              })),
            })),
          })),
        })),
      },
    }
  }

  stream() {
    return this.realtime.stream(
      getCurrentStoreId(),
      new Set([
        'order.created',
        'order.status_changed',
        'dining.session_updated',
        'catalog.product_updated',
      ]),
    )
  }

  async openSession(
    tableId: string,
    payload: WaiterOpenSessionPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    return this.dining.openSession(
      tableId,
      {
        guestCount: payload.guestCount,
        waiterId: authUser.role === 'waiter' ? authUser.sub : undefined,
      },
      {
        expectedTableVersion: payload.expectedTableVersion,
      },
    )
  }

  async sendItems(
    sessionId: string,
    payload: WaiterSendItemsPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    await this.assertSessionAccess(sessionId, authUser)

    return this.dining.addItems(
      sessionId,
      {
        items: payload.items.map((item) => ({
          ...item,
          waiterId: authUser.role === 'waiter' ? authUser.sub : undefined,
        })),
      },
      {
        expectedVersion: payload.expectedVersion,
      },
    )
  }

  async requestClose(
    sessionId: string,
    payload: WaiterExpectedVersionPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    await this.assertSessionAccess(sessionId, authUser)
    return this.dining.updateSession(
      sessionId,
      { status: 'awaiting_close' },
      { expectedVersion: payload.expectedVersion },
    )
  }

  async transferSession(
    sessionId: string,
    payload: WaiterTransferSessionPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    await this.assertSessionAccess(sessionId, authUser)
    return this.dining.transferSession(
      sessionId,
      {
        targetTableId: payload.targetTableId,
        actor: authUser.name,
      },
      {
        expectedVersion: payload.expectedVersion,
        expectedTargetTableVersion: payload.expectedTargetTableVersion,
      },
    )
  }

  async cancelItem(
    sessionId: string,
    itemId: string,
    payload: WaiterCancelItemPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    const item = await this.prisma.tableSessionItem.findFirst({
      where: {
        id: itemId,
        sessionId,
        session: {
          storeId: getCurrentStoreId(),
        },
      },
      include: {
        session: {
          include: {
            table: true,
          },
        },
        productionOrder: {
          include: {
            items: true,
            driver: true,
          },
        },
        productionOrderItem: true,
      },
    })

    if (!item) throw new NotFoundException('Item da comanda nao encontrado.')
    this.assertOwnership(item.session.waiterId, authUser)
    if (item.session.status === 'closed') throw new BadRequestException('A conta ja foi fechada.')
    if (item.cancelledAt) throw new BadRequestException('Este item ja foi cancelado.')
    if (item.deliveredAt) throw new BadRequestException('Um item entregue nao pode ser cancelado.')
    if (!item.productionOrder || !item.productionOrderItem) {
      throw new BadRequestException('O item historico nao possui vinculo com a producao.')
    }

    const nextSubtotal = Math.max(0, item.session.subtotal.toNumber() - item.totalPrice.toNumber())
    const nextTotal = Math.max(
      0,
      nextSubtotal - item.session.discount.toNumber() + item.session.serviceFee.toNumber(),
    )
    const changedAt = new Date()
    const order = item.productionOrder
    const orderItem = item.productionOrderItem

    await this.prisma.$transaction(async (tx) => {
      await this.claimSession(tx, sessionId, payload.expectedVersion)
      await tx.tableSessionItem.update({
        where: { id: item.id },
        data: {
          cancelledAt: changedAt,
          cancelledById: authUser.sub,
          cancelReason: payload.reason,
        },
      })
      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: {
          cancelledAt: changedAt,
          cancelReason: payload.reason,
        },
      })
      await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          subtotal: nextSubtotal,
          total: nextTotal,
          events: {
            create: {
              type: 'updated',
              label: `${item.quantity}x ${item.name} cancelado(s): ${payload.reason}`,
              actor: authUser.name,
              metadata: {
                itemId: item.id,
                orderId: order.id,
                reason: payload.reason,
              },
            },
          },
        },
      })
      await tx.diningTable.update({
        where: { id: item.session.tableId },
        data: { version: { increment: 1 } },
      })
      await this.printingPolicy.createOrderJobs(tx, {
        storeId: getCurrentStoreId(),
        eventId: `table-session:${sessionId}:item:${item.id}:cancelled`,
        jobType: 'ORDER_REMOVAL',
        order,
        items: [
          {
            productId: orderItem.productId,
            name: orderItem.name,
            quantity: orderItem.quantity,
            unitPrice: orderItem.unitPrice.toNumber(),
            notes: orderItem.notes,
            options: orderItem.options,
          },
        ],
      })

      const remaining = await tx.tableSessionItem.count({
        where: {
          productionOrderId: order.id,
          cancelledAt: null,
        },
      })
      if (remaining === 0 && !['completed', 'cancelled'].includes(order.status)) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'cancelled',
            history: {
              create: {
                status: 'cancelled',
                label: 'Todos os itens deste envio foram cancelados no salao',
                actor: authUser.name,
              },
            },
          },
        })
      }
    })

    this.realtime.emit('dining.session_updated', {
      sessionId,
      tableId: item.session.tableId,
      reason: 'item_cancelled',
    })
    this.realtime.emit('order.status_changed', {
      orderId: order.id,
      status: 'cancelled_or_updated',
    })
    return this.dining.getTableById(item.session.tableId)
  }

  async deliverItem(
    sessionId: string,
    itemId: string,
    payload: WaiterExpectedVersionPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    const item = await this.prisma.tableSessionItem.findFirst({
      where: {
        id: itemId,
        sessionId,
        session: { storeId: getCurrentStoreId() },
      },
      include: {
        session: { include: { table: true } },
        productionOrder: true,
      },
    })

    if (!item) throw new NotFoundException('Item da comanda nao encontrado.')
    this.assertOwnership(item.session.waiterId, authUser)
    if (item.cancelledAt) throw new BadRequestException('Um item cancelado nao pode ser entregue.')
    if (item.deliveredAt) throw new BadRequestException('Este item ja foi entregue.')
    if (item.productionOrder?.status !== 'ready') {
      throw new BadRequestException('A cozinha ainda nao marcou este item como pronto.')
    }

    const deliveredAt = new Date()
    let orderCompleted = false
    await this.prisma.$transaction(async (tx) => {
      await this.claimSession(tx, sessionId, payload.expectedVersion)
      await tx.tableSessionItem.update({
        where: { id: item.id },
        data: {
          deliveredAt,
          deliveredById: authUser.sub,
        },
      })
      await tx.tableSessionEvent.create({
        data: {
          sessionId,
          type: 'updated',
          label: `${item.quantity}x ${item.name} entregue(s)`,
          actor: authUser.name,
          metadata: { itemId: item.id, orderId: item.productionOrderId },
        },
      })
      await tx.diningTable.update({
        where: { id: item.session.tableId },
        data: { version: { increment: 1 } },
      })

      if (item.productionOrderId) {
        const pending = await tx.tableSessionItem.count({
          where: {
            productionOrderId: item.productionOrderId,
            cancelledAt: null,
            deliveredAt: null,
          },
        })
        if (pending === 0) {
          orderCompleted = true
          await tx.order.update({
            where: { id: item.productionOrderId },
            data: {
              status: 'completed',
              history: {
                create: {
                  status: 'completed',
                  label: 'Itens entregues na mesa',
                  actor: authUser.name,
                },
              },
            },
          })
        }
      }
    })

    this.realtime.emit('dining.session_updated', {
      sessionId,
      tableId: item.session.tableId,
      reason: 'item_delivered',
    })
    if (orderCompleted && item.productionOrderId) {
      this.realtime.emit('order.status_changed', {
        orderId: item.productionOrderId,
        status: 'completed',
      })
    }
    return this.dining.getTableById(item.session.tableId)
  }

  private async assertSessionAccess(sessionId: string, authUser: AuthenticatedRequestUser) {
    const session = await this.prisma.tableSession.findFirst({
      where: { id: sessionId, storeId: getCurrentStoreId() },
      select: { waiterId: true },
    })
    if (!session) throw new NotFoundException('Sessao de mesa nao encontrada.')
    this.assertOwnership(session.waiterId, authUser)
  }

  private assertOwnership(waiterId: string | null, authUser: AuthenticatedRequestUser) {
    if (authUser.role !== 'manager' && waiterId !== authUser.sub) {
      throw new ForbiddenException('Apenas o garcom responsavel pode alterar esta mesa.')
    }
  }

  private async claimSession(
    tx: Prisma.TransactionClient,
    sessionId: string,
    expectedVersion: number,
  ) {
    const claimed = await tx.tableSession.updateMany({
      where: {
        id: sessionId,
        storeId: getCurrentStoreId(),
        version: expectedVersion,
        status: { not: 'closed' },
      },
      data: { version: { increment: 1 } },
    })
    if (claimed.count !== 1) {
      throw new ConflictException({
        code: 'STALE_WAITER_STATE',
        message: 'A comanda mudou em outro dispositivo. Recarregue antes de continuar.',
      })
    }
  }
}
