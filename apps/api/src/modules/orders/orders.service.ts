import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { OrderChannel, OrderStatus, Prisma } from '@prisma/client'

import type {
  CreateOrderPayload,
  ListOrdersQuery,
  UpdateOrderStatusPayload,
} from '@/contracts/orders.contract'
import { channelLabelMap, statusLabelMap } from '@/shared/mappers/domain-labels'
import { buildListResponse, normalizePagination } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { calculateRouteEta, type GeoCoordinate } from '@/shared/routing/routing.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapOrder } from './orders.mapper'

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AdminRealtimeService,
  ) {}

  async listOrders(query: ListOrdersQuery) {
    const where = this.buildWhere(query)
    const pagination = normalizePagination(query)
    const [orders, total, totalOpen, delayed, ready, routing] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          history: true,
          driver: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: {
          ...where,
          status: {
            notIn: ['completed', 'cancelled'],
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          delayed: true,
          status: {
            not: 'completed',
          },
        },
      }),
      this.prisma.order.count({ where: { ...where, status: 'ready' } }),
      this.prisma.order.count({ where: { ...where, status: 'out_for_delivery' } }),
    ])

    return {
      ...buildListResponse(orders.map(mapOrder), total, query),
      summary: {
        totalOpen,
        delayed,
        ready,
        routing,
      },
    }
  }

  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        items: true,
        history: true,
        driver: true,
      },
    })

    return {
      data: order ? mapOrder(order) : null,
    }
  }

  async getOrderTracking(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        driver: true,
      },
    })

    if (!order) {
      throw new NotFoundException('Pedido nao encontrado.')
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: {
        id: DEFAULT_STORE_ID,
      },
    })
    const destination = this.resolveOrderCoordinate(order)
    const driverLocation = order.driverId
      ? await this.prisma.driverLocation.findFirst({
          where: {
            storeId: DEFAULT_STORE_ID,
            driverId: order.driverId,
            isActive: true,
          },
          orderBy: {
            capturedAt: 'desc',
          },
        })
      : null
    const origin = driverLocation
      ? {
          latitude: driverLocation.latitude.toNumber(),
          longitude: driverLocation.longitude.toNumber(),
        }
      : {
          latitude: store.latitude.toNumber(),
          longitude: store.longitude.toNumber(),
        }
    const route =
      order.status === 'out_for_delivery'
        ? await calculateRouteEta([origin, destination])
        : null
    const etaMinutes = route
      ? Math.max(1, Math.round(route.durationSeconds / 60))
      : Math.max(1, Math.round((order.dueAt.getTime() - Date.now()) / (60 * 1000)))

    if (route && order.driverId) {
      await this.prisma.etaSnapshot.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          orderId: order.id,
          driverId: order.driverId,
          provider: route.provider,
          etaMinutes,
          durationSeconds: Math.round(route.durationSeconds),
          distanceMeters: Math.round(route.distanceMeters),
          fromLatitude: origin.latitude,
          fromLongitude: origin.longitude,
          toLatitude: destination.latitude,
          toLongitude: destination.longitude,
          routeGeometry: routeGeometryToJson(route.geometry),
          message: 'ETA publico calculado sem expor outras paradas.',
        },
      })
    }

    return {
      data: {
        orderId: order.id,
        orderNumber: order.number,
        status: order.status,
        message: this.getTrackingMessage(order.status, Boolean(driverLocation)),
        etaMinutes,
        provider: route?.provider ?? 'fallback',
        driver: order.driver
          ? {
              id: order.driver.id,
              name: order.driver.name,
              phone: order.driver.phone ?? '',
            }
          : null,
        driverLocation: driverLocation
          ? {
              latitude: roundCoordinate(driverLocation.latitude.toNumber()),
              longitude: roundCoordinate(driverLocation.longitude.toNumber()),
              capturedAt: driverLocation.capturedAt.toISOString(),
              speedKmh: driverLocation.speedKmh?.toNumber() ?? 0,
            }
          : null,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  async createOrder(payload: CreateOrderPayload) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: {
        id: DEFAULT_STORE_ID,
      },
    })
    const customer = payload.customerId
      ? await this.prisma.customer.findFirst({
          where: {
            id: payload.customerId,
            storeId: DEFAULT_STORE_ID,
          },
          include: {
            addresses: true,
          },
        })
      : null
    const diningTable = payload.tableId
      ? await this.prisma.diningTable.findFirst({
          where: {
            id: payload.tableId,
            storeId: DEFAULT_STORE_ID,
          },
        })
      : null

    const address =
      customer?.addresses.find((entry) => entry.id === payload.addressId) ??
      customer?.addresses[0] ??
      null
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: payload.items.map((item) => item.productId),
        },
        storeId: DEFAULT_STORE_ID,
      },
    })
    const items = payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)

      if (!product) {
        throw new NotFoundException(`Produto ${item.productId} nao encontrado.`)
      }

      return {
        product,
        quantity: item.quantity,
      }
    })
    const subtotal = items.reduce(
      (sum, item) => sum + item.product.price.toNumber() * item.quantity,
      0,
    )
    const deliveryFee = payload.channel === 'delivery' ? 8.5 : 0
    const status: OrderStatus = payload.sendToProduction ? 'in_preparation' : 'in_analysis'
    const estimatedPrepTimeMinutes = this.getEstimatedPrepTime(store, payload.channel)
    const estimatedDeliveryTimeMinutes =
      payload.channel === 'delivery' ? store.estimatedDeliveryTimeMinutes : null
    const estimatedTotalTimeMinutes =
      estimatedPrepTimeMinutes + (estimatedDeliveryTimeMinutes ?? 0)
    const number = await this.nextOrderNumber()
    const createdAt = new Date()
    const deliveryCoordinate =
      payload.channel === 'delivery'
        ? this.resolveAddressCoordinate(
            address,
            `${customer?.id ?? 'walk_in'}-${address?.label ?? payload.notes ?? number}`,
          )
        : null

    const order = await this.prisma.order.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        number,
        customerId: customer?.id,
        customerName: customer?.name ?? 'Cliente sem cadastro',
        customerPhone: customer?.phone ?? '',
        source: payload.channel,
        serviceType: payload.channel,
        status,
        paymentMethod: payload.paymentMethod,
        paymentStatus: payload.paymentMethod === 'cash' ? 'pending' : 'paid',
        subtotal,
        deliveryFee,
        discount: 0,
        total: subtotal + deliveryFee,
        dueAt: new Date(Date.now() + estimatedTotalTimeMinutes * 60 * 1000),
        estimatedPrepTimeMinutes,
        estimatedDeliveryTimeMinutes,
        estimatedTotalTimeMinutes,
        priority: 'normal',
        delayed: false,
        tags: [channelLabelMap[payload.channel]],
        addressLabel: address?.label,
        addressText: address
          ? `${address.street}, ${address.number} - ${address.district}`
          : undefined,
        deliveryLatitude: deliveryCoordinate?.latitude,
        deliveryLongitude: deliveryCoordinate?.longitude,
        tableCode: diningTable ? `Mesa ${diningTable.code}` : undefined,
        notes: payload.notes,
        items: {
          create: items.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            options: [],
          })),
        },
        history: {
          create: [
            {
              status: 'in_analysis',
              label: 'Pedido criado no admin',
              actor: 'Operacao',
              createdAt,
            },
            {
              status,
              label: payload.sendToProduction
                ? 'Enviado direto para producao'
                : 'Mantido em analise',
              actor: 'Operacao',
              createdAt,
            },
          ],
        },
      },
      include: {
        items: true,
        history: true,
        driver: true,
      },
    })

    if (payload.paymentMethod !== 'cash') {
      await this.registerSaleMovement(number, subtotal + deliveryFee, payload.paymentMethod)
    }

    this.realtime.emit('order.created', {
      orderId: order.id,
    })
    this.realtime.emit('order.status_changed', {
      orderId: order.id,
      status: order.status,
      driverId: order.driverId ?? null,
    })

    return {
      data: mapOrder(order),
    }
  }

  async updateStatus(orderId: string, payload: UpdateOrderStatusPayload) {
    const current = await this.prisma.order.findFirstOrThrow({
      where: {
        id: orderId,
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        driver: true,
      },
    })
    const nextStatus = this.resolveNextStatus(current.status, payload.action)
    const nextDriverId =
      payload.action === 'dispatch'
        ? await this.resolveDriverAssignment(current.source, payload.driverId)
        : current.driverId

    const order = await this.prisma.order.update({
      where: {
        id: current.id,
      },
      data: {
        status: nextStatus,
        driverId: nextDriverId,
        tags:
          payload.action === 'cancel' && !current.tags.includes('Cancelado')
            ? [...current.tags, 'Cancelado']
            : current.tags,
        history: {
          create: {
            status: nextStatus,
            label: this.cleanDatabaseText(this.actionLabel(payload.action)),
            actor: this.cleanDatabaseText(await this.resolveActor(payload, nextDriverId)),
          },
        },
      },
      include: {
        items: true,
        history: true,
        driver: true,
      },
    })

    await this.syncDriverAvailability(nextDriverId)
    await this.syncDeliveryAssignment({
      action: payload.action,
      orderId: current.id,
      driverId: nextDriverId,
    })

    this.realtime.emit('order.status_changed', {
      orderId: current.id,
      status: nextStatus,
      driverId: nextDriverId ?? current.driverId ?? null,
    })

    if (current.driverId && current.driverId !== nextDriverId) {
      this.realtime.emit('driver.queue_updated', {
        driverId: current.driverId,
        reason: 'route-released',
      })
    }

    if (nextDriverId) {
      this.realtime.emit('driver.queue_updated', {
        driverId: nextDriverId,
        reason: payload.action,
      })

      const refreshedMembership = await this.prisma.storeUser.findFirst({
        where: {
          storeId: DEFAULT_STORE_ID,
          userId: nextDriverId,
          role: 'driver',
        },
        include: {
          driverProfile: true,
        },
      })

      if (refreshedMembership?.driverProfile) {
        this.realtime.emit('driver.status_updated', {
          driverId: nextDriverId,
          availability: refreshedMembership.driverProfile.availability,
          currentOrderId: nextStatus === 'out_for_delivery' ? current.id : null,
        })
      }
    }

    return {
      data: mapOrder(order),
    }
  }

  async repeatOrder(orderId: string) {
    const current = await this.prisma.order.findFirstOrThrow({
      where: {
        id: orderId,
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        items: true,
      },
    })
    const number = await this.nextOrderNumber()

    const order = await this.prisma.order.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        number,
        customerId: current.customerId,
        customerName: current.customerName,
        customerPhone: current.customerPhone,
        source: current.source,
        serviceType: current.serviceType,
        status: 'in_analysis',
        paymentMethod: current.paymentMethod,
        paymentStatus: current.paymentStatus,
        subtotal: current.subtotal,
        deliveryFee: current.deliveryFee,
        discount: current.discount,
        total: current.total,
        dueAt: new Date(
          Date.now() + (current.estimatedTotalTimeMinutes ?? 35) * 60 * 1000,
        ),
        estimatedPrepTimeMinutes: current.estimatedPrepTimeMinutes,
        estimatedDeliveryTimeMinutes: current.estimatedDeliveryTimeMinutes,
        estimatedTotalTimeMinutes: current.estimatedTotalTimeMinutes,
        priority: current.priority,
        delayed: false,
        tags: current.tags,
        addressLabel: current.addressLabel,
        addressText: current.addressText,
        deliveryLatitude: current.deliveryLatitude,
        deliveryLongitude: current.deliveryLongitude,
        tableCode: current.tableCode,
        notes: current.notes,
        driverId: null,
        items: {
          create: current.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
            options: item.options ?? [],
          })),
        },
        history: {
          create: {
            status: 'in_analysis',
            label: 'Pedido recriado a partir do historico',
            actor: 'Operacao',
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

  private buildWhere(query: ListOrdersQuery): Prisma.OrderWhereInput {
    const search = query.search?.trim()

    return {
      storeId: DEFAULT_STORE_ID,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.source && query.source !== 'all' ? { source: query.source } : {}),
      ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
      ...(query.paymentMethod && query.paymentMethod !== 'all'
        ? { paymentMethod: query.paymentMethod }
        : {}),
      ...(query.delayedOnly ? { delayed: true } : {}),
    }
  }

  private async nextOrderNumber() {
    const count = await this.prisma.order.count({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
    })

    return `#${1001 + count}`
  }

  private resolveNextStatus(current: OrderStatus, action: UpdateOrderStatusPayload['action']) {
    if (action === 'accept') {
      return 'in_preparation'
    }

    if (action === 'start_preparation') {
      return 'in_preparation'
    }

    if (action === 'ready') {
      return 'ready'
    }

    if (action === 'dispatch') {
      return 'out_for_delivery'
    }

    if (action === 'complete') {
      return 'completed'
    }

    if (action === 'cancel') {
      return 'cancelled'
    }

    return current
  }

  private actionLabel(action: UpdateOrderStatusPayload['action']) {
    if (action === 'accept') {
      return 'Pedido aceito e enviado para producao'
    }

    return statusLabelMap[this.resolveNextStatus('in_analysis', action)]
  }

  private getEstimatedPrepTime(
    store: {
      estimatedPrepTimeMinutes: number
      estimatedDineInTimeMinutes: number
      estimatedCounterTimeMinutes: number
      estimatedPickupTimeMinutes: number
    },
    channel: OrderChannel,
  ) {
    if (channel === 'dine_in') {
      return store.estimatedDineInTimeMinutes
    }

    if (channel === 'counter') {
      return store.estimatedCounterTimeMinutes
    }

    if (channel === 'pickup') {
      return store.estimatedPickupTimeMinutes
    }

    return store.estimatedPrepTimeMinutes
  }

  private resolveOrderCoordinate(order: {
    id: string
    addressLabel: string | null
    addressText: string | null
    deliveryLatitude: Prisma.Decimal | null
    deliveryLongitude: Prisma.Decimal | null
  }): GeoCoordinate {
    if (order.deliveryLatitude && order.deliveryLongitude) {
      return {
        latitude: order.deliveryLatitude.toNumber(),
        longitude: order.deliveryLongitude.toNumber(),
      }
    }

    return fallbackCoordinateFromText(
      `${order.id}-${order.addressLabel ?? ''}-${order.addressText ?? ''}`,
    )
  }

  private resolveAddressCoordinate(
    address:
      | {
          id: string
          label: string
          street: string
          number: string
          district: string
          latitude: Prisma.Decimal | null
          longitude: Prisma.Decimal | null
        }
      | null,
    fallbackSeed: string,
  ) {
    if (address?.latitude && address.longitude) {
      return {
        latitude: address.latitude.toNumber(),
        longitude: address.longitude.toNumber(),
      }
    }

    return fallbackCoordinateFromText(
      address
        ? `${address.id}-${address.street}-${address.number}-${address.district}`
        : fallbackSeed,
    )
  }

  private getTrackingMessage(status: OrderStatus, hasDriverLocation: boolean) {
    if (status === 'out_for_delivery') {
      return hasDriverLocation
        ? 'Motoboy a caminho do seu pedido'
        : 'Motoboy em rota. Localizacao momentaneamente indisponivel.'
    }

    if (status === 'ready') {
      return 'Pedido pronto aguardando despacho ou retirada.'
    }

    if (status === 'in_preparation') {
      return 'Pedido em preparo.'
    }

    if (status === 'completed') {
      return 'Pedido entregue.'
    }

    if (status === 'cancelled') {
      return 'Pedido cancelado.'
    }

    return 'Pedido recebido pela loja.'
  }

  private async resolveDriverAssignment(source: OrderChannel, driverId?: string) {
    if (source !== 'delivery') {
      return null
    }

    if (!driverId) {
      throw new BadRequestException('Selecione um motoboy para despachar o pedido.')
    }

    const driver = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        active: true,
        role: 'driver',
        userId: driverId,
        driverProfile: {
          active: true,
          availability: {
            in: ['available', 'delivering'],
          },
        },
      },
      include: {
        driverProfile: true,
      },
    })

    if (!driver) {
      throw new BadRequestException(
        'Nenhum motoboy disponivel foi encontrado para este despacho.',
      )
    }

    await this.prisma.driverProfile.update({
      where: {
        storeUserId: driver.id,
      },
      data: {
        availability: 'delivering',
        lastActivityAt: new Date(),
      },
    })

    return driver.userId
  }

  private async resolveActor(payload: UpdateOrderStatusPayload, driverId: string | null) {
    if (payload.actor) {
      return payload.actor
    }

    if (payload.action === 'dispatch' && driverId) {
      const driver = await this.prisma.user.findUnique({
        where: {
          id: driverId,
        },
      })

      if (driver) {
        return driver.name
      }
    }

    return 'Operacao'
  }

  private cleanDatabaseText(value: string) {
    const safe = value
      .replace(/\uFFFD/g, '')
      .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '')
      .trim()

    return safe || 'Sistema'
  }

  private async syncDriverAvailability(driverId: string | null) {
    if (!driverId) {
      return
    }

    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        userId: driverId,
        role: 'driver',
      },
      include: {
        driverProfile: true,
      },
    })

    if (!membership?.driverProfile) {
      return
    }

    const activeDeliveries = await this.prisma.order.count({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        status: 'out_for_delivery',
      },
    })

    await this.prisma.driverProfile.update({
      where: {
        storeUserId: membership.id,
      },
      data: {
        availability: activeDeliveries > 0 ? 'delivering' : 'available',
        lastActivityAt: new Date(),
      },
    })
  }

  private async syncDeliveryAssignment(params: {
    action: UpdateOrderStatusPayload['action']
    orderId: string
    driverId: string | null
  }) {
    if (params.action === 'dispatch' && params.driverId) {
      const membership = await this.prisma.storeUser.findFirst({
        where: {
          storeId: DEFAULT_STORE_ID,
          userId: params.driverId,
          role: 'driver',
        },
      })

      if (!membership) {
        return
      }

      const activeAssignments = await this.prisma.deliveryAssignment.count({
        where: {
          storeId: DEFAULT_STORE_ID,
          driverId: params.driverId,
          status: 'active',
        },
      })
      const sequence = activeAssignments + 1

      await this.prisma.deliveryAssignment.upsert({
        where: {
          orderId_status: {
            orderId: params.orderId,
            status: 'active',
          },
        },
        update: {
          driverId: params.driverId,
          storeUserId: membership.id,
          finalSequence: sequence,
          plannedSequence: sequence,
        },
        create: {
          storeId: DEFAULT_STORE_ID,
          orderId: params.orderId,
          driverId: params.driverId,
          storeUserId: membership.id,
          plannedSequence: sequence,
          finalSequence: sequence,
          status: 'active',
        },
      })

      return
    }

    if (params.action === 'complete' || params.action === 'cancel') {
      await this.prisma.deliveryAssignment.updateMany({
        where: {
          storeId: DEFAULT_STORE_ID,
          orderId: params.orderId,
          status: 'active',
        },
        data: {
          status: params.action === 'complete' ? 'completed' : 'cancelled',
          completedAt: new Date(),
        },
      })
    }
  }

  private async registerSaleMovement(
    orderNumber: string,
    amount: number,
    method: CreateOrderPayload['paymentMethod'],
  ) {
    const register = await this.prisma.cashRegister.findFirst({
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

    await this.prisma.cashRegister.update({
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
            label: `Pedido ${orderNumber}`,
            userName: 'Sistema',
          },
        },
      },
    })
  }
}

function fallbackCoordinateFromText(value: string): GeoCoordinate {
  const store = {
    latitude: -3.1019,
    longitude: -60.0217,
  }
  const seed = Math.abs(
    value.split('').reduce((hash, char) => {
      return (hash << 5) - hash + char.charCodeAt(0)
    }, 0),
  )
  const angle = (seed % 360) * (Math.PI / 180)
  const radius = 0.011

  return {
    longitude: store.longitude + Math.cos(angle) * radius,
    latitude: store.latitude + Math.sin(angle) * radius * 0.72,
  }
}

function roundCoordinate(value: number) {
  return Math.round(value * 10000) / 10000
}

function routeGeometryToJson(geometry: GeoCoordinate[]): Prisma.InputJsonValue {
  return {
    coordinates: geometry.map((point) => [point.longitude, point.latitude]),
  } as Prisma.InputJsonValue
}
