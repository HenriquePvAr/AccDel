import type { Prisma } from '@prisma/client'

import { toNumber } from '@/shared/mappers/number'

type DiningAreaRecord = Prisma.DiningAreaGetPayload<Record<string, never>>

type DiningTableRecord = Prisma.DiningTableGetPayload<{
  include: {
    area: true
    waiter: true
    currentSession: {
      include: {
        table: true
        waiter: true
        items: true
        events: true
      }
    }
  }
}>

type TableSessionRecord = Prisma.TableSessionGetPayload<{
  include: {
    table: true
    waiter: true
    items: true
    events: true
  }
}>

export function mapDiningArea(area: DiningAreaRecord) {
  return {
    id: area.id,
    name: area.name,
    color: area.color,
    sortOrder: area.sortOrder,
  }
}

export function mapDiningTable(table: DiningTableRecord) {
  return {
    id: table.id,
    code: table.code,
    areaId: table.areaId,
    areaName: table.area.name,
    capacity: table.capacity,
    status: table.status,
    guests: table.guests ?? undefined,
    waiterId: table.waiterId ?? undefined,
    waiterName: table.waiter?.name ?? undefined,
    currentSessionId: table.currentSessionId ?? undefined,
    notes: table.notes ?? undefined,
  }
}

export function mapTableSession(session: TableSessionRecord) {
  return {
    id: session.id,
    tableId: session.tableId,
    tableCode: session.table.code,
    waiterId: session.waiterId ?? undefined,
    waiterName: session.waiter?.name ?? undefined,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString(),
    guestCount: session.guestCount,
    subtotal: toNumber(session.subtotal),
    discount: toNumber(session.discount),
    serviceFee: toNumber(session.serviceFee),
    total: toNumber(session.total),
    paymentMethod: session.paymentMethod ?? undefined,
    status: session.status,
    notes: session.notes ?? undefined,
    items: session.items
      .slice()
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((item) => ({
        id: item.id,
        productId: item.productId ?? '',
        name: item.name,
        quantity: item.quantity,
        unitPrice: toNumber(item.unitPrice),
        totalPrice: toNumber(item.totalPrice),
        notes: item.notes ?? undefined,
        options: Array.isArray(item.options) ? item.options : [],
        createdAt: item.createdAt.toISOString(),
        createdByName: item.createdByName ?? undefined,
      })),
    timeline: session.events
      .slice()
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((event) => ({
        id: event.id,
        label: event.label,
        actor: event.actor,
        at: event.createdAt.toISOString(),
      })),
  }
}

export function buildDiningTablesSnapshot(args: {
  areas: DiningAreaRecord[]
  tables: DiningTableRecord[]
}) {
  return {
    data: {
      areas: args.areas.map(mapDiningArea),
      tables: args.tables.map(mapDiningTable),
      sessions: args.tables
        .map((table) => table.currentSession)
        .filter((session): session is NonNullable<typeof session> => Boolean(session))
        .map(mapTableSession),
    },
  }
}
