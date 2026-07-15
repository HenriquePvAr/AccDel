import { ConflictException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  Prisma,
  PrintJobStatus,
  PrintJobType,
  Printer,
  PrinterStation,
} from '@prisma/client'

import type {
  PrintableOrder,
  PrintableOrderItem,
  PrintJobSnapshot,
  PrintSnapshotItem,
} from './printing.types'
import {
  hashPrintPayload,
  maskPrintPhone,
  readSnapshotOptions,
  toNumber,
} from './printing.utils'

interface CreateOrderPrintJobsInput {
  storeId: string
  eventId: string
  jobType:
    | 'ORDER_INITIAL'
    | 'ORDER_ADDITION'
    | 'ORDER_CANCELLATION'
    | 'ORDER_REMOVAL'
    | 'ORDER_CORRECTION'
  order: PrintableOrder
  items: PrintableOrderItem[]
}

interface CreateOperationalPrintJobInput {
  storeId: string
  eventId: string
  jobType: 'CASHIER_RECEIPT' | 'DISPATCH_ORDER' | 'CUSTOMER_RECEIPT'
  stationCode: 'CAIXA' | 'EXPEDICAO'
  order: PrintableOrder
  items: PrintableOrderItem[]
}

type StationWithPrinters = PrinterStation & { printers: Printer[] }

@Injectable()
export class PrintingPolicyService {
  async createOrderJobs(
    tx: Prisma.TransactionClient,
    input: CreateOrderPrintJobsInput,
  ) {
    const settings = await tx.printingSettings.findUnique({
      where: { storeId: input.storeId },
      include: { fallbackStation: true },
    })

    if (!settings?.enabled) {
      return []
    }

    if (input.jobType === 'ORDER_CANCELLATION' && !settings.printCancellation) {
      return []
    }

    const productIds = Array.from(
      new Set(input.items.flatMap((item) => (item.productId ? [item.productId] : []))),
    )
    const products = await tx.product.findMany({
      where: { storeId: input.storeId, id: { in: productIds } },
      select: { id: true, categoryId: true },
    })
    const categoryIds = Array.from(new Set(products.map((product) => product.categoryId)))
    const rules = await tx.printerRoutingRule.findMany({
      where: {
        storeId: input.storeId,
        enabled: true,
        OR: [{ productId: { in: productIds } }, { categoryId: { in: categoryIds } }],
      },
      include: { station: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
    const productById = new Map(products.map((product) => [product.id, product]))
    const grouped = new Map<string, { stationId: string | null; items: PrintableOrderItem[] }>()

    for (const item of input.items) {
      const product = item.productId ? productById.get(item.productId) : null
      const productRule = product
        ? rules.find(
            (rule) =>
              rule.scope === 'PRODUCT' &&
              rule.productId === product.id &&
              rule.station.enabled,
          )
        : null
      const categoryRule = product
        ? rules.find(
            (rule) =>
              rule.scope === 'CATEGORY' &&
              rule.categoryId === product.categoryId &&
              rule.station.enabled,
          )
        : null
      const routedStationId =
        productRule?.stationId ??
        categoryRule?.stationId ??
        (settings.fallbackPolicy === 'DEFAULT_STATION' && settings.fallbackStation?.enabled
          ? settings.fallbackStationId
          : null)
      const groupKey = routedStationId ?? 'UNROUTED'
      const group = grouped.get(groupKey) ?? { stationId: routedStationId, items: [] }
      group.items.push(item)
      grouped.set(groupKey, group)
    }

    const stationIds = Array.from(grouped.values()).flatMap((group) =>
      group.stationId ? [group.stationId] : [],
    )
    const stations = await tx.printerStation.findMany({
      where: { storeId: input.storeId, id: { in: stationIds } },
      include: {
        printers: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    })
    const stationById = new Map(stations.map((station) => [station.id, station]))
    const jobIds: string[] = []

    for (const group of grouped.values()) {
      const station = group.stationId ? stationById.get(group.stationId) ?? null : null
      const jobId = await this.persistJob(tx, {
        storeId: input.storeId,
        eventId: input.eventId,
        jobType: input.jobType,
        order: input.order,
        items: group.items,
        station,
        maxAttempts: settings.defaultMaxAttempts,
      })
      jobIds.push(jobId)
    }

    return jobIds
  }

  async createOperationalJob(
    tx: Prisma.TransactionClient,
    input: CreateOperationalPrintJobInput,
  ) {
    const settings = await tx.printingSettings.findUnique({
      where: { storeId: input.storeId },
    })

    if (!settings?.enabled) {
      return null
    }

    if (input.jobType === 'DISPATCH_ORDER' && !settings.printOrderReady) {
      return null
    }

    if (input.jobType === 'CASHIER_RECEIPT' && !settings.printPaymentConfirmed) {
      return null
    }

    if (input.jobType === 'CUSTOMER_RECEIPT' && !settings.customerReceiptEnabled) {
      return null
    }

    const station = await tx.printerStation.findFirst({
      where: {
        storeId: input.storeId,
        code: input.stationCode,
        enabled: true,
      },
      include: {
        printers: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    })

    return this.persistJob(tx, {
      storeId: input.storeId,
      eventId: input.eventId,
      jobType: input.jobType,
      order: input.order,
      items: input.items,
      station,
      maxAttempts: settings.defaultMaxAttempts,
    })
  }

  private async persistJob(
    tx: Prisma.TransactionClient,
    input: {
      storeId: string
      eventId: string
      jobType: PrintJobType
      order: PrintableOrder
      items: PrintableOrderItem[]
      station: StationWithPrinters | null
      maxAttempts: number
    },
  ) {
    const id = randomUUID()
    const printer =
      input.station?.printers.find((candidate) => candidate.enabled) ??
      input.station?.printers[0] ??
      null
    const template = templateFor(input.jobType, input.station?.code ?? null)
    const persistedTemplate = await tx.printTemplate.findFirst({
      where: {
        storeId: input.storeId,
        key: template.key,
        version: template.version,
        enabled: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    const status: PrintJobStatus =
      !input.station || !printer || !printer.enabled ? 'FAILED' : 'PENDING'
    const errorCode = !input.station
      ? 'ROUTING_MISSING'
      : !printer
        ? 'PRINTER_MISSING'
        : !printer.enabled
          ? 'PRINTER_DISABLED'
          : null
    const snapshot = buildSnapshot({
      id,
      jobType: input.jobType,
      order: input.order,
      items: input.items,
      station: input.station,
    })
    const payloadHash = hashPrintPayload(snapshot)
    const idempotencyKey = [
      'print',
      input.eventId,
      input.station?.id ?? 'unrouted',
      input.jobType,
      `${template.key}:${template.version}`,
    ].join(':')
    const saved = await tx.printJob.upsert({
      where: {
        storeId_idempotencyKey: {
          storeId: input.storeId,
          idempotencyKey,
        },
      },
      create: {
        id,
        storeId: input.storeId,
        printerId: printer?.id,
        stationId: input.station?.id,
        stationCode: input.station?.code,
        orderId: input.order.id,
        templateId: persistedTemplate?.id,
        jobType: input.jobType,
        templateKey: template.key,
        templateVersion: template.version,
        payloadSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        payloadHash,
        status,
        priority: priorityFor(input.order.priority, input.jobType),
        maxAttempts: input.maxAttempts,
        failedAt: status === 'FAILED' ? new Date() : null,
        lastErrorCode: errorCode,
        lastErrorMessageSanitized: errorMessageFor(errorCode),
        idempotencyKey,
      },
      update: {},
    })

    if (saved.payloadHash !== payloadHash) {
      throw new ConflictException({
        code: 'PRINT_IDEMPOTENCY_CONFLICT',
        message: 'O mesmo evento de impressao foi reutilizado com outro snapshot.',
      })
    }

    if (saved.id === id) {
      await tx.printAuditLog.create({
        data: {
          storeId: input.storeId,
          jobId: saved.id,
          printerId: printer?.id,
          action: status === 'FAILED' ? 'JOB_CREATED_BLOCKED' : 'JOB_CREATED',
          metadata: {
            jobType: input.jobType,
            stationCode: input.station?.code ?? null,
            errorCode,
          },
        },
      })
    }

    return saved.id
  }
}

function buildSnapshot(input: {
  id: string
  jobType: PrintJobType
  order: PrintableOrder
  items: PrintableOrderItem[]
  station: PrinterStation | null
}): PrintJobSnapshot {
  const includePrices = ['CASHIER_RECEIPT', 'CUSTOMER_RECEIPT'].includes(input.jobType)
  const includeDispatch = input.jobType === 'DISPATCH_ORDER'
  const items: PrintSnapshotItem[] = includeDispatch
    ? []
    : input.items.map((item) => ({
        productId: item.productId,
        name: item.name.slice(0, 160),
        quantity: item.quantity,
        notes: item.notes?.slice(0, 280) ?? null,
        options: readSnapshotOptions(item.options),
        ...(includePrices
          ? {
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
            }
          : {}),
      }))

  return {
    schemaVersion: 1,
    jobId: input.id,
    documentType: input.jobType,
    marker: 'ORIGINAL',
    order: {
      id: input.order.id,
      number: input.order.number,
      createdAt: input.order.createdAt.toISOString(),
      serviceType: input.order.serviceType,
      tableCode: input.order.tableCode,
      priority: input.order.priority,
      notes: input.order.notes?.slice(0, 360) ?? null,
    },
    station: {
      id: input.station?.id ?? null,
      code: input.station?.code ?? null,
      name: input.station?.name ?? null,
    },
    items,
    ...(includePrices
      ? {
          financial: {
            subtotal: toNumber(input.order.subtotal),
            deliveryFee: toNumber(input.order.deliveryFee),
            discount: toNumber(input.order.discount),
            total: toNumber(input.order.total),
            paymentMethod: input.order.paymentMethod,
            paymentStatus: input.order.paymentStatus,
          },
        }
      : {}),
    ...(includeDispatch
      ? {
          dispatch: {
            customerName: input.order.customerName.slice(0, 120),
            maskedPhone: maskPrintPhone(input.order.customerPhone),
            address: input.order.addressText?.slice(0, 220) ?? null,
            addressReference: input.order.addressLabel?.slice(0, 100) ?? null,
            paymentMethod: input.order.paymentMethod,
            amountToCollect:
              input.order.paymentStatus === 'paid' ? 0 : toNumber(input.order.total),
            driverName: input.order.driver?.name.slice(0, 120) ?? null,
          },
        }
      : {}),
  }
}

function templateFor(jobType: PrintJobType, stationCode: string | null) {
  if (jobType === 'CASHIER_RECEIPT') {
    return { key: 'cashier-receipt', version: 'v1' }
  }

  if (jobType === 'DISPATCH_ORDER') {
    return { key: 'dispatch-order', version: 'v1' }
  }

  if (jobType === 'CUSTOMER_RECEIPT') {
    return { key: 'customer-receipt', version: 'v1' }
  }

  return { key: stationCode === 'BAR' ? 'bar-order' : 'kitchen-order', version: 'v1' }
}

function priorityFor(priority: string, jobType: PrintJobType) {
  const orderPriority = priority === 'vip' ? 100 : priority === 'priority' ? 50 : 0
  const eventPriority = jobType === 'ORDER_CANCELLATION' ? 30 : jobType === 'DISPATCH_ORDER' ? 10 : 0
  return orderPriority + eventPriority
}

function errorMessageFor(code: string | null) {
  switch (code) {
    case 'ROUTING_MISSING':
      return 'Nenhuma estacao segura foi resolvida para os itens.'
    case 'PRINTER_MISSING':
      return 'A estacao nao possui impressora configurada.'
    case 'PRINTER_DISABLED':
      return 'A impressora configurada para a estacao esta desativada.'
    default:
      return null
  }
}
