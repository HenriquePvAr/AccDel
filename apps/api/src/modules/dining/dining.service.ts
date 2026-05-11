import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Prisma, TableSessionEventType } from '@prisma/client'

import type {
  AddTableSessionItemPayload,
  CloseTableSessionPayload,
  OpenTableSessionPayload,
  SaveDiningTablePayload,
  SplitTableSessionPayload,
  TransferTableSessionPayload,
  UpdateDiningTableStatusPayload,
  UpdateTableSessionPayload,
} from '@/contracts/dining.contract'
import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { buildDiningTablesSnapshot, mapDiningArea, mapDiningTable, mapTableSession } from './dining.mapper'

const diningTableInclude = {
  area: true,
  waiter: true,
  currentSession: {
    include: {
      table: true,
      waiter: true,
      items: true,
      events: true,
    },
  },
} satisfies Prisma.DiningTableInclude

const tableSessionInclude = {
  table: true,
  waiter: true,
  items: true,
  events: true,
} satisfies Prisma.TableSessionInclude

@Injectable()
export class DiningService {
  constructor(private readonly prisma: PrismaService) {}

  async listAreas() {
    const areas = await this.prisma.diningArea.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    })

    return buildListResponse(areas.map(mapDiningArea), areas.length)
  }

  async listTables() {
    const [areas, tables] = await Promise.all([
      this.prisma.diningArea.findMany({
        where: {
          storeId: DEFAULT_STORE_ID,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],
      }),
      this.prisma.diningTable.findMany({
        where: {
          storeId: DEFAULT_STORE_ID,
        },
        include: diningTableInclude,
        orderBy: {
          code: 'asc',
        },
      }),
    ])

    const sortedTables = tables.slice().sort((left, right) => {
      const areaDelta = left.area.sortOrder - right.area.sortOrder
      if (areaDelta !== 0) {
        return areaDelta
      }

      return left.code.localeCompare(right.code)
    })

    return buildDiningTablesSnapshot({
      areas,
      tables: sortedTables,
    })
  }

  async getTableById(tableId: string) {
    const table = await this.prisma.diningTable.findFirst({
      where: {
        id: tableId,
        storeId: DEFAULT_STORE_ID,
      },
      include: diningTableInclude,
    })

    if (!table) {
      throw new NotFoundException('Mesa nao encontrada.')
    }

    return {
      data: {
        table: mapDiningTable(table),
        session: table.currentSession ? mapTableSession(table.currentSession) : null,
      },
    }
  }

  async createTable(payload: SaveDiningTablePayload) {
    await this.ensureArea(payload.table.areaId)

    const table = await this.prisma.diningTable.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        areaId: payload.table.areaId,
        code: payload.table.code.trim(),
        capacity: payload.table.capacity,
        status: payload.table.status ?? 'free',
        notes: normalizeNullableString(payload.table.notes),
      },
      include: diningTableInclude,
    })

    return {
      data: mapDiningTable(table),
    }
  }

  async updateTable(tableId: string, payload: SaveDiningTablePayload) {
    const current = await this.ensureTable(tableId)
    await this.ensureArea(payload.table.areaId)
    this.assertStatusChangeAllowed(current, payload.table.status ?? current.status)

    const table = await this.prisma.diningTable.update({
      where: {
        id: current.id,
      },
      data: {
        areaId: payload.table.areaId,
        code: payload.table.code.trim(),
        capacity: payload.table.capacity,
        status: payload.table.status ?? current.status,
        notes: normalizeNullableString(payload.table.notes),
      },
      include: diningTableInclude,
    })

    return {
      data: mapDiningTable(table),
    }
  }

  async updateTableStatus(tableId: string, payload: UpdateDiningTableStatusPayload) {
    const current = await this.ensureTable(tableId)
    this.assertStatusChangeAllowed(current, payload.status)

    const table = await this.prisma.diningTable.update({
      where: {
        id: current.id,
      },
      data: buildTableStatusUpdate(current, payload.status),
      include: diningTableInclude,
    })

    return {
      data: mapDiningTable(table),
    }
  }

  async openSession(tableId: string, payload: OpenTableSessionPayload) {
    const table = await this.ensureTable(tableId)

    if (table.currentSessionId) {
      throw new BadRequestException('A mesa ja possui uma sessao ativa.')
    }

    if (!['free', 'reserved', 'closed'].includes(table.status)) {
      throw new BadRequestException('A mesa nao pode ser aberta no status atual.')
    }

    const waiterMembership = payload.waiterId
      ? await this.ensureWaiter(payload.waiterId)
      : null
    const actor = waiterMembership?.user.name ?? 'Operacao'

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tableSession.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          tableId: table.id,
          waiterId: waiterMembership?.userId,
          guestCount: payload.guestCount,
          notes: normalizeNullableString(payload.notes),
          status: 'open',
          subtotal: 0,
          discount: 0,
          serviceFee: 0,
          total: 0,
          events: {
            create: [
              {
                type: 'opened',
                label: `Mesa ${table.code} aberta com ${payload.guestCount} pessoas`,
                actor,
                metadata: {
                  tableId: table.id,
                },
              },
              ...(waiterMembership
                ? [
                    {
                      type: 'waiter_assigned' as TableSessionEventType,
                      label: `Garcom ${waiterMembership.user.name} atribuido a mesa`,
                      actor,
                      metadata: {
                        waiterId: waiterMembership.userId,
                      },
                    },
                  ]
                : []),
            ],
          },
        },
        include: tableSessionInclude,
      })

      await tx.diningTable.update({
        where: {
          id: table.id,
        },
        data: {
          currentSessionId: created.id,
          status: 'occupied',
          guests: payload.guestCount,
          waiterId: waiterMembership?.userId ?? null,
        },
      })

      if (waiterMembership) {
        await this.bumpWaiterMetrics(tx, waiterMembership.userId, {
          status: 'serving',
          lastActivityAt: new Date(),
          historyLabel: `Mesa ${table.code} aberta`,
          historyValue: null,
        })
      }

      return tx.tableSession.findUniqueOrThrow({
        where: {
          id: created.id,
        },
        include: tableSessionInclude,
      })
    })

    return {
      data: mapTableSession(session),
    }
  }

  async addItem(sessionId: string, payload: AddTableSessionItemPayload) {
    const session = await this.ensureSession(sessionId)

    if (session.status === 'closed') {
      throw new BadRequestException('Nao e possivel adicionar itens a uma conta fechada.')
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: payload.productId,
        storeId: DEFAULT_STORE_ID,
        active: true,
        availability: {
          some: {
            channel: 'dine_in',
            available: true,
            visible: true,
            soldOut: false,
          },
        },
      },
    })

    if (!product) {
      throw new NotFoundException('Produto indisponivel para o salao.')
    }

    const waiterMembership = payload.waiterId
      ? await this.ensureWaiter(payload.waiterId)
      : session.waiterId
        ? await this.ensureWaiter(session.waiterId)
        : null
    const actor = waiterMembership?.user.name ?? session.waiter?.name ?? 'Operacao'
    const lineTotal = product.price.toNumber() * payload.quantity
    const nextStatus = session.status === 'awaiting_close' ? 'open' : session.status

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.update({
        where: {
          id: session.id,
        },
        data: {
          waiterId: waiterMembership?.userId ?? session.waiterId,
          status: nextStatus,
          subtotal: {
            increment: lineTotal,
          },
          total: {
            increment: lineTotal,
          },
          items: {
            create: {
              productId: product.id,
              name: product.name,
              quantity: payload.quantity,
              unitPrice: product.price,
              totalPrice: lineTotal,
              notes: normalizeNullableString(payload.notes),
            },
          },
          events: {
            create: [
              ...(session.status === 'awaiting_close'
                ? [
                    {
                      type: 'reopened' as TableSessionEventType,
                      label: 'Conta reaberta para novo lancamento',
                      actor,
                      metadata: {},
                    },
                  ]
                : []),
              {
                type: 'item_added' as TableSessionEventType,
                label: `${payload.quantity}x ${product.name} lancado(s) na mesa`,
                actor,
                metadata: {
                  productId: product.id,
                  quantity: payload.quantity,
                },
              },
            ],
          },
        },
      })

      await tx.diningTable.update({
        where: {
          id: session.tableId,
        },
        data: {
          status: 'occupied',
          waiterId: waiterMembership?.userId ?? session.waiterId,
          guests: session.guestCount,
        },
      })

      if (waiterMembership) {
        await this.bumpWaiterMetrics(tx, waiterMembership.userId, {
          status: 'serving',
          incrementOrders: 1,
          lastActivityAt: new Date(),
          historyLabel: `${payload.quantity}x ${product.name} lancado(s) na mesa ${session.table.code}`,
          historyValue: lineTotal,
        })
      }

      return tx.tableSession.findUniqueOrThrow({
        where: {
          id: session.id,
        },
        include: tableSessionInclude,
      })
    })

    return {
      data: mapTableSession(updated),
    }
  }

  async updateSession(sessionId: string, payload: UpdateTableSessionPayload) {
    const session = await this.ensureSession(sessionId)

    if (session.status === 'closed') {
      throw new BadRequestException('A conta ja foi fechada.')
    }

    const waiterMembership =
      payload.waiterId === undefined
        ? session.waiterId
          ? await this.ensureWaiter(session.waiterId)
          : null
        : payload.waiterId
          ? await this.ensureWaiter(payload.waiterId)
          : null

    const nextStatus = payload.status ?? session.status
    const actor = waiterMembership?.user.name ?? session.waiter?.name ?? 'Operacao'
    const events: Prisma.TableSessionEventCreateWithoutSessionInput[] = []

    if (payload.waiterId !== undefined && payload.waiterId !== session.waiterId) {
      events.push({
        type: 'waiter_assigned',
        label: waiterMembership
          ? `Garcom ${waiterMembership.user.name} assumiu a mesa`
          : 'Garcom removido da sessao',
        actor,
        metadata: {
          waiterId: waiterMembership?.userId ?? null,
        },
      })
    }

    if (payload.status && payload.status !== session.status) {
      events.push({
        type: payload.status === 'awaiting_close' ? 'awaiting_close' : 'reopened',
        label:
          payload.status === 'awaiting_close'
            ? 'Mesa sinalizada para fechamento'
            : 'Mesa retomada para atendimento',
        actor,
        metadata: {},
      })
    }

    if (payload.guestCount && payload.guestCount !== session.guestCount) {
      events.push({
        type: 'updated',
        label: `Quantidade de pessoas ajustada para ${payload.guestCount}`,
        actor,
        metadata: {
          guestCount: payload.guestCount,
        },
      })
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.update({
        where: {
          id: session.id,
        },
        data: {
          waiterId: payload.waiterId === undefined ? session.waiterId : waiterMembership?.userId ?? null,
          guestCount: payload.guestCount ?? session.guestCount,
          notes:
            payload.notes === undefined ? session.notes : normalizeNullableString(payload.notes),
          status: nextStatus,
          events: events.length
            ? {
                create: events,
              }
            : undefined,
        },
      })

      await tx.diningTable.update({
        where: {
          id: session.tableId,
        },
        data: {
          waiterId: payload.waiterId === undefined ? session.waiterId : waiterMembership?.userId ?? null,
          guests: payload.guestCount ?? session.guestCount,
          status: nextStatus === 'awaiting_close' ? 'closing' : 'occupied',
        },
      })

      if (waiterMembership) {
        await this.bumpWaiterMetrics(tx, waiterMembership.userId, {
          status: 'serving',
          lastActivityAt: new Date(),
          historyLabel:
            nextStatus === 'awaiting_close'
              ? `Mesa ${session.table.code} aguardando fechamento`
              : `Mesa ${session.table.code} atualizada`,
          historyValue: null,
        })
      }

      return tx.tableSession.findUniqueOrThrow({
        where: {
          id: session.id,
        },
        include: tableSessionInclude,
      })
    })

    return {
      data: mapTableSession(updated),
    }
  }

  async closeSession(sessionId: string, payload: CloseTableSessionPayload) {
    const session = await this.ensureSession(sessionId)

    if (session.status === 'closed') {
      throw new BadRequestException('A conta da mesa ja foi fechada.')
    }

    const subtotal = session.items.reduce((sum, item) => sum + item.totalPrice.toNumber(), 0)
    const discount = payload.discount ?? session.discount.toNumber()
    const serviceFee = payload.serviceFee ?? session.serviceFee.toNumber()
    const total = Math.max(0, subtotal - discount + serviceFee)
    const actor = payload.actor ?? session.waiter?.name ?? 'Caixa'
    const closedAt = new Date()

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.update({
        where: {
          id: session.id,
        },
        data: {
          subtotal,
          discount,
          serviceFee,
          total,
          paymentMethod: payload.paymentMethod,
          status: 'closed',
          closedAt,
          events: {
            create: {
              type: 'closed',
              label: `Conta fechada em ${session.table.code}`,
              actor,
              metadata: {
                paymentMethod: payload.paymentMethod,
                total,
              },
            },
          },
        },
      })

      await tx.diningTable.update({
        where: {
          id: session.tableId,
        },
        data: {
          status: 'closed',
          currentSessionId: null,
          guests: null,
          waiterId: null,
        },
      })

      if (session.waiterId) {
        await this.bumpWaiterMetrics(tx, session.waiterId, {
          status: 'available',
          incrementTables: 1,
          incrementSales: total,
          lastActivityAt: closedAt,
          historyLabel: `Mesa ${session.table.code} fechada`,
          historyValue: total,
        })
      }

      await this.registerDiningSale(tx, session.table.code, total, payload.paymentMethod)

      return tx.tableSession.findUniqueOrThrow({
        where: {
          id: session.id,
        },
        include: tableSessionInclude,
      })
    })

    return {
      data: mapTableSession(updated),
    }
  }

  async transferSession(sessionId: string, payload: TransferTableSessionPayload) {
    const session = await this.ensureSession(sessionId)

    if (session.status === 'closed') {
      throw new BadRequestException('Nao e possivel transferir uma conta fechada.')
    }

    if (payload.targetTableId === session.tableId) {
      throw new BadRequestException('Selecione outra mesa para a transferencia.')
    }

    const targetTable = await this.ensureTable(payload.targetTableId)

    if (targetTable.currentSessionId) {
      throw new BadRequestException('A mesa de destino ja possui uma sessao ativa.')
    }

    if (!['free', 'reserved', 'closed'].includes(targetTable.status)) {
      throw new BadRequestException('A mesa de destino nao pode receber a transferencia.')
    }

    const actor = payload.actor ?? session.waiter?.name ?? 'Operacao'

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.diningTable.update({
        where: {
          id: session.tableId,
        },
        data: {
          currentSessionId: null,
          status: 'free',
          guests: null,
          waiterId: null,
        },
      })

      await tx.tableSession.update({
        where: {
          id: session.id,
        },
        data: {
          tableId: targetTable.id,
          events: {
            create: {
              type: 'transferred',
              label: `Conta transferida da mesa ${session.table.code} para ${targetTable.code}`,
              actor,
              metadata: {
                fromTableId: session.tableId,
                toTableId: targetTable.id,
              },
            },
          },
        },
      })

      await tx.diningTable.update({
        where: {
          id: targetTable.id,
        },
        data: {
          currentSessionId: session.id,
          status: session.status === 'awaiting_close' ? 'closing' : 'occupied',
          guests: session.guestCount,
          waiterId: session.waiterId,
        },
      })

      return tx.tableSession.findUniqueOrThrow({
        where: {
          id: session.id,
        },
        include: tableSessionInclude,
      })
    })

    return {
      data: mapTableSession(updated),
    }
  }

  async splitSession(sessionId: string, payload: SplitTableSessionPayload) {
    const session = await this.ensureSession(sessionId)

    if (session.status === 'closed') {
      throw new BadRequestException('Nao e possivel separar uma conta fechada.')
    }

    const selectedItems = session.items.filter((item) => payload.itemIds.includes(item.id))

    if (!selectedItems.length) {
      throw new BadRequestException('Selecione ao menos um item para separar.')
    }

    if (selectedItems.length === session.items.length) {
      throw new BadRequestException(
        'Use o fechamento da mesa para encerrar todos os itens de uma vez.',
      )
    }

    const actor = payload.actor ?? session.waiter?.name ?? 'Caixa'
    const splitSubtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice.toNumber(), 0)
    const remainingItems = session.items.filter((item) => !payload.itemIds.includes(item.id))
    const remainingSubtotal = remainingItems.reduce(
      (sum, item) => sum + item.totalPrice.toNumber(),
      0,
    )
    const remainingTotal = Math.max(
      0,
      remainingSubtotal - session.discount.toNumber() + session.serviceFee.toNumber(),
    )

    const result = await this.prisma.$transaction(async (tx) => {
      const splitSession = await tx.tableSession.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          tableId: session.tableId,
          waiterId: session.waiterId,
          guestCount: Math.max(1, Math.min(session.guestCount, selectedItems.length)),
          subtotal: splitSubtotal,
          discount: 0,
          serviceFee: 0,
          total: splitSubtotal,
          paymentMethod: payload.paymentMethod,
          status: 'closed',
          notes: `Conta separada da mesa ${session.table.code}`,
          openedAt: session.openedAt,
          closedAt: new Date(),
          items: {
            create: selectedItems.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              notes: item.notes,
            })),
          },
          events: {
            create: [
              {
                type: 'split',
                label: `Conta separada a partir da mesa ${session.table.code}`,
                actor,
                metadata: {
                  sourceSessionId: session.id,
                  itemIds: payload.itemIds,
                },
              },
              {
                type: 'closed',
                label: `Conta separada paga em ${session.table.code}`,
                actor,
                metadata: {
                  paymentMethod: payload.paymentMethod,
                  total: splitSubtotal,
                },
              },
            ],
          },
        },
        include: tableSessionInclude,
      })

      await tx.tableSessionItem.deleteMany({
        where: {
          sessionId: session.id,
          id: {
            in: payload.itemIds,
          },
        },
      })

      await tx.tableSession.update({
        where: {
          id: session.id,
        },
        data: {
          subtotal: remainingSubtotal,
          total: remainingTotal,
          events: {
            create: {
              type: 'split',
              label: `${selectedItems.length} item(ns) separados da conta`,
              actor,
              metadata: {
                splitSessionId: splitSession.id,
                itemIds: payload.itemIds,
              },
            },
          },
        },
      })

      if (session.waiterId) {
        await this.bumpWaiterMetrics(tx, session.waiterId, {
          lastActivityAt: new Date(),
          historyLabel: `Conta separada na mesa ${session.table.code}`,
          historyValue: splitSubtotal,
        })
      }

      await this.registerDiningSale(tx, session.table.code, splitSubtotal, payload.paymentMethod)

      const updatedSource = await tx.tableSession.findUniqueOrThrow({
        where: {
          id: session.id,
        },
        include: tableSessionInclude,
      })

      return {
        session: updatedSource,
        splitSession,
      }
    })

    return {
      data: {
        session: mapTableSession(result.session),
        splitSession: mapTableSession(result.splitSession),
      },
    }
  }

  private async ensureArea(areaId: string) {
    const area = await this.prisma.diningArea.findFirst({
      where: {
        id: areaId,
        storeId: DEFAULT_STORE_ID,
      },
    })

    if (!area) {
      throw new NotFoundException('Area do salao nao encontrada.')
    }

    return area
  }

  private async ensureTable(tableId: string) {
    const table = await this.prisma.diningTable.findFirst({
      where: {
        id: tableId,
        storeId: DEFAULT_STORE_ID,
      },
      include: diningTableInclude,
    })

    if (!table) {
      throw new NotFoundException('Mesa nao encontrada.')
    }

    return table
  }

  private async ensureSession(sessionId: string) {
    const session = await this.prisma.tableSession.findFirst({
      where: {
        id: sessionId,
        storeId: DEFAULT_STORE_ID,
      },
      include: tableSessionInclude,
    })

    if (!session) {
      throw new NotFoundException('Sessao de mesa nao encontrada.')
    }

    return session
  }

  private async ensureWaiter(waiterId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'waiter',
        userId: waiterId,
        active: true,
        waiterProfile: {
          active: true,
          status: {
            in: ['available', 'serving'],
          },
        },
      },
      include: {
        user: true,
        waiterProfile: true,
      },
    })

    if (!membership) {
      throw new BadRequestException('Selecione um garcom ativo para esta operacao.')
    }

    return membership
  }

  private assertStatusChangeAllowed(
    table: Awaited<ReturnType<DiningService['ensureTable']>>,
    nextStatus: 'free' | 'occupied' | 'reserved' | 'closing' | 'closed',
  ) {
    if (table.currentSessionId && ['free', 'reserved', 'closed'].includes(nextStatus)) {
      throw new BadRequestException(
        'Nao e possivel alterar a mesa para este status enquanto houver sessao ativa.',
      )
    }

    if (!table.currentSessionId && ['occupied', 'closing'].includes(nextStatus)) {
      throw new BadRequestException(
        'Abra uma sessao antes de marcar a mesa como ocupada ou aguardando fechamento.',
      )
    }
  }

  private async bumpWaiterMetrics(
    tx: Prisma.TransactionClient,
    waiterId: string,
    args: {
      status?: 'available' | 'serving' | 'paused'
      incrementOrders?: number
      incrementTables?: number
      incrementSales?: number
      lastActivityAt?: Date
      historyLabel: string
      historyValue: number | null
    },
  ) {
    const membership = await tx.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'waiter',
        userId: waiterId,
      },
      include: {
        waiterProfile: true,
      },
    })

    if (!membership?.waiterProfile) {
      return
    }

    await tx.waiterProfile.update({
      where: {
        storeUserId: membership.id,
      },
      data: {
        status: args.status,
        totalOrders: args.incrementOrders
          ? {
              increment: args.incrementOrders,
            }
          : undefined,
        tablesServed: args.incrementTables
          ? {
              increment: args.incrementTables,
            }
          : undefined,
        totalSales: args.incrementSales
          ? {
              increment: args.incrementSales,
            }
          : undefined,
        lastActivityAt: args.lastActivityAt,
        history: {
          create: {
            label: args.historyLabel,
            value: args.historyValue,
          },
        },
      },
    })
  }

  private async registerDiningSale(
    tx: Prisma.TransactionClient,
    tableCode: string,
    amount: number,
    method: CloseTableSessionPayload['paymentMethod'],
  ) {
    const register = await tx.cashRegister.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        status: 'open',
      },
      orderBy: {
        openedAt: 'desc',
      },
    })

    if (!register) {
      return
    }

    await tx.cashRegister.update({
      where: {
        id: register.id,
      },
      data: {
        expectedAmount: {
          increment: amount,
        },
        movements: {
          create: {
            type: 'sale',
            method,
            amount,
            label: `Mesa ${tableCode}`,
            userName: 'Salao',
          },
        },
      },
    })
  }
}

function normalizeNullableString(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildTableStatusUpdate(
  table: {
    guests: number | null
    waiterId: string | null
  },
  status: 'free' | 'occupied' | 'reserved' | 'closing' | 'closed',
) {
  if (status === 'free' || status === 'reserved' || status === 'closed') {
    return {
      status,
      guests: status === 'reserved' ? table.guests : null,
      waiterId: status === 'reserved' ? table.waiterId : null,
    }
  }

  return {
    status,
  }
}
