import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type OrderChannel,
  OrderItem,
  OrderNotificationType,
  OrderStatus,
  ProductChannel,
} from '@prisma/client'

import type {
  CreateOrderPayload,
  CreatePublicOrderPayload,
  ConfirmOrderPaymentPayload,
  ListOrdersQuery,
  RepeatOrderPayload,
  UpdateOrderStatusPayload,
} from '@/contracts/orders.contract'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { PrintingPolicyService } from '@/modules/printing/printing-policy.service'
import { PublicTrackingService } from '@/modules/tracking/public-tracking.service'
import { FeatureFlagsService } from '@/shared/operations/feature-flags.service'
import {
  type ResolvedProductOption,
  type SelectedProductOptionInput,
  resolveProductOptionSelection,
  toProductOptionsJson,
} from '@/modules/catalog/product-options'
import { channelLabelMap, statusLabelMap } from '@/shared/mappers/domain-labels'
import { buildListResponse, normalizePagination } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { calculateRouteEta, type GeoCoordinate } from '@/shared/routing/routing.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { mapOrder } from './orders.mapper'
import {
  OrderTransitionError,
  resolveOrderTransition,
} from './order-state-machine'
import { canTransitionPayment } from './payment-state-machine'
import { extractRepeatItemSelections } from './repeat-order-policy'

type OrderProductRecord = Prisma.ProductGetPayload<{
  include: {
    availability: true
    optionGroups: {
      include: {
        group: {
          include: {
            options: true
          }
        }
      }
    }
  }
}>

interface PricedOrderItem {
  product: OrderProductRecord
  quantity: number
  unitPrice: number
  notes?: string
  options: ResolvedProductOption[]
}

interface OrderItemSelectionInput {
  productId: string
  quantity: number
  notes?: string
  options?: SelectedProductOptionInput[]
}

interface DeliveryPricingResult {
  fee: number
  estimatedDeliveryTimeMinutes: number
  zoneId?: string
  neighborhood?: string
}

interface PromotionRuleConfig {
  requiredItems: number
  participantType: 'category' | 'product'
  participantId?: string
  sizeLabel?: string
  flavorLimitPerItem?: number
  finalPrice?: number
}

interface PromotionAdjustment {
  promotionId?: string
  promotionName?: string
  discount: number
}

interface CouponAdjustment {
  couponId?: string
  couponCode?: string
  discount: number
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AdminRealtimeService,
    private readonly printingPolicy: PrintingPolicyService,
    private readonly publicTracking: PublicTrackingService,
    private readonly features?: FeatureFlagsService,
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
        storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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
        id: getCurrentStoreId(),
      },
    })
    const destination = this.resolveOrderCoordinate(order)
    const driverLocation = order.driverId
      ? await this.prisma.driverLocation.findFirst({
          where: {
            storeId: getCurrentStoreId(),
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
          storeId: getCurrentStoreId(),
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

  async createOrder(
    payload: CreateOrderPayload,
    authUser: AuthenticatedRequestUser,
    trustedContext?: {
      source: OrderChannel
      messagingAccountId?: string
      conversationId?: string
    },
  ) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: {
        id: getCurrentStoreId(),
      },
    })
    const customer = payload.customerId
      ? await this.prisma.customer.findFirst({
          where: {
            id: payload.customerId,
            storeId: getCurrentStoreId(),
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
            storeId: getCurrentStoreId(),
          },
        })
      : null

    const address =
      customer?.addresses.find((entry) => entry.id === payload.addressId) ??
      customer?.addresses[0] ??
      null

    if (payload.channel === 'delivery' && !customer?.phone) {
      throw new BadRequestException('Nao e possivel criar delivery sem telefone do cliente.')
    }

    if (payload.channel === 'delivery' && !address) {
      throw new BadRequestException('Nao e possivel criar delivery sem endereco.')
    }

    const catalogChannel = resolveCatalogChannel(payload.channel)
    const items = await this.resolvePricedItems(
      payload.items,
      catalogChannel,
      channelLabelMap[payload.channel],
    )
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )
    const promotionAdjustment = await this.resolvePromotionAdjustment(catalogChannel, items)
    const subtotalAfterPromotion = Math.max(0, subtotal - promotionAdjustment.discount)
    const couponAdjustment = payload.couponCode
      ? await this.resolveCouponAdjustment(payload.couponCode, catalogChannel, subtotalAfterPromotion)
      : { discount: 0 }
    const discount = promotionAdjustment.discount + couponAdjustment.discount
    const deliveryFee =
      payload.channel === 'delivery' ? store.defaultDeliveryFee.toNumber() : 0
    const status: OrderStatus = payload.sendToProduction ? 'in_preparation' : 'in_analysis'
    const estimatedPrepTimeMinutes = this.getEstimatedPrepTime(store, payload.channel)
    const estimatedDeliveryTimeMinutes =
      payload.channel === 'delivery' ? store.estimatedDeliveryTimeMinutes : null
    const estimatedTotalTimeMinutes =
      estimatedPrepTimeMinutes + (estimatedDeliveryTimeMinutes ?? 0)
    const number = await this.nextOrderNumber()
    const orderId = randomUUID()
    const createdAt = new Date()
    const deliveryCoordinate =
      payload.channel === 'delivery'
        ? this.resolveAddressCoordinate(
            address,
            `${customer?.id ?? 'walk_in'}-${address?.label ?? payload.notes ?? number}`,
          )
        : null

    const order = await this.prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
      data: {
        id: orderId,
        storeId: getCurrentStoreId(),
        number,
        customerId: customer?.id,
        customerName: customer?.name ?? 'Cliente sem cadastro',
        customerPhone: customer?.phone ?? '',
        source: trustedContext?.source ?? payload.channel,
        serviceType: payload.channel,
        status,
        paymentMethod: payload.paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        deliveryFee,
        discount,
        couponCode: couponAdjustment.couponCode,
        promotionName: promotionAdjustment.promotionName,
        discountBreakdown: this.buildDiscountBreakdown(
          subtotal,
          promotionAdjustment,
          couponAdjustment,
        ),
        total: Math.max(0, subtotal - discount) + deliveryFee,
        dueAt: new Date(Date.now() + estimatedTotalTimeMinutes * 60 * 1000),
        estimatedPrepTimeMinutes,
        estimatedDeliveryTimeMinutes,
        estimatedTotalTimeMinutes,
        priority: 'normal',
        delayed: false,
        tags: [
          channelLabelMap[payload.channel],
          ...(promotionAdjustment.promotionName
            ? [`Promocao: ${promotionAdjustment.promotionName}`]
            : []),
          ...(couponAdjustment.couponCode ? [`Cupom: ${couponAdjustment.couponCode}`] : []),
        ],
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
            unitPrice: item.unitPrice,
            notes: item.notes,
            options: toProductOptionsJson(item.options),
          })),
        },
        history: {
          create: [
            {
              status: 'in_analysis',
              label: 'Pedido criado no admin',
              actor: this.cleanDatabaseText(authUser.name),
              createdAt,
            },
            {
              status,
              label: payload.sendToProduction
                ? 'Enviado direto para producao'
                : 'Mantido em analise',
              actor: this.cleanDatabaseText(authUser.name),
              createdAt,
            },
            ...(discount > 0
              ? [
                  {
                    status,
                    label: `Desconto aplicado: R$ ${discount.toFixed(2)}`,
                    actor: 'Sistema',
                    createdAt,
                  },
                ]
              : []),
          ],
        },
        ...(trustedContext?.source === 'whatsapp'
          ? {
              notifications: {
                create: {
                  storeId: getCurrentStoreId(),
                  accountId: trustedContext.messagingAccountId,
                  conversationId: trustedContext.conversationId,
                  type: 'ORDER_CONFIRMED' as const,
                  idempotencyKey: `order:${orderId}:confirmed`,
                },
              },
            }
          : {}),
      },
      include: {
        items: true,
        history: true,
        driver: true,
      },
      })

      if (status === 'in_preparation') {
        await this.printingPolicy.createOrderJobs(transaction, {
          storeId: getCurrentStoreId(),
          eventId: `order-created:${orderId}`,
          jobType: 'ORDER_INITIAL',
          order: createdOrder,
          items: createdOrder.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toNumber(),
          })),
        })
      }

      if (couponAdjustment.couponId) {
        await transaction.coupon.update({
          where: {
            id: couponAdjustment.couponId,
          },
          data: {
            uses: {
              increment: 1,
            },
          },
        })
      }

      return createdOrder
    })

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

  async createWhatsappOrder(
    payload: Omit<CreateOrderPayload, 'channel' | 'sendToProduction'> & {
      serviceType: 'delivery' | 'pickup'
    },
    messaging?: { accountId: string; conversationId: string },
  ) {
    return this.createOrder(
      {
        ...payload,
        channel: payload.serviceType,
        sendToProduction: false,
      },
      {
        sub: 'whatsapp-ai-system',
        email: 'whatsapp-ai@internal.invalid',
        name: 'Atendente WhatsApp',
        storeId: getCurrentStoreId(),
        role: 'owner',
        permissions: [],
      },
      {
        source: 'whatsapp',
        messagingAccountId: messaging?.accountId,
        conversationId: messaging?.conversationId,
      },
    )
  }

  async createPublicOrder(payload: CreatePublicOrderPayload) {
    const normalizedPhone = normalizePhone(payload.customerPhone)
    const store = await this.prisma.store.findUniqueOrThrow({
      where: {
        id: getCurrentStoreId(),
      },
    })
    const serviceType = payload.orderMode === 'delivery' ? 'delivery' : 'pickup'

    if (!store.digitalMenuEnabled) {
      throw new BadRequestException('Cardapio digital indisponivel para receber pedidos agora.')
    }

    if (serviceType === 'delivery' && !store.deliveryEnabled) {
      throw new BadRequestException('Delivery esta desativado para o cardapio digital.')
    }

    if (serviceType === 'pickup' && !store.pickupEnabled) {
      throw new BadRequestException('Retirada esta desativada para o cardapio digital.')
    }

    const paymentConfig = await this.prisma.paymentMethodConfig.findFirst({
      where: {
        id: payload.paymentMethodId,
        storeId: getCurrentStoreId(),
        active: true,
        channels: {
          has: 'digital_menu',
        },
      },
    })

    if (!paymentConfig?.method) {
      throw new BadRequestException('Forma de pagamento indisponivel para o cardapio digital.')
    }
    const paymentMethod = paymentConfig.method

    if (paymentConfig.provider === 'picpay' && !paymentConfig.externalEnabled) {
      throw new BadRequestException('PicPay ainda nao esta configurado para checkout real.')
    }

    const customer = await this.upsertPublicCustomer({
      name: payload.customerName,
      phone: normalizedPhone,
    })
    const deliveryPricing =
      serviceType === 'delivery'
        ? await this.resolveDeliveryPricing(payload.neighborhood ?? '', store)
        : null
    const address =
      serviceType === 'delivery'
        ? await this.upsertPublicAddress(customer.id, payload, {
            city: store.city,
            state: store.state,
          })
        : null
    const items = await this.resolvePricedItems(
      payload.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        options: item.selectedOptions,
      })),
      'digital_menu',
      'Cardapio digital',
    )
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )
    const minimumOrderAmount = store.minimumOrderAmount.toNumber()

    if (minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
      throw new BadRequestException(
        `Pedido minimo de R$ ${minimumOrderAmount.toFixed(2).replace('.', ',')} nao atingido.`,
      )
    }

    const promotionAdjustment = await this.resolvePromotionAdjustment('digital_menu', items)
    const discount = promotionAdjustment.discount
    const deliveryFee = deliveryPricing?.fee ?? 0
    const status: OrderStatus = 'in_preparation'
    const estimatedPrepTimeMinutes = this.getEstimatedPrepTime(store, serviceType)
    const estimatedDeliveryTimeMinutes =
      serviceType === 'delivery'
        ? (deliveryPricing?.estimatedDeliveryTimeMinutes ?? store.estimatedDeliveryTimeMinutes)
        : null
    const estimatedTotalTimeMinutes =
      estimatedPrepTimeMinutes + (estimatedDeliveryTimeMinutes ?? 0)
    const number = await this.nextOrderNumber()
    const orderId = randomUUID()
    const createdAt = new Date()
    const deliveryCoordinate =
      serviceType === 'delivery'
        ? this.resolveAddressCoordinate(
            address,
            `${customer.id}-${payload.neighborhood ?? ''}-${number}`,
          )
        : null
    const total = Math.max(0, subtotal - discount) + deliveryFee

    const result = await this.prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          id: orderId,
        storeId: getCurrentStoreId(),
        number,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        source: 'digital_menu',
        serviceType,
        status,
        paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        deliveryFee,
        discount,
        promotionName: promotionAdjustment.promotionName,
        discountBreakdown: this.buildDiscountBreakdown(
          subtotal,
          promotionAdjustment,
          { discount: 0 },
        ),
        total,
        dueAt: new Date(Date.now() + estimatedTotalTimeMinutes * 60 * 1000),
        estimatedPrepTimeMinutes,
        estimatedDeliveryTimeMinutes,
        estimatedTotalTimeMinutes,
        priority: 'normal',
        delayed: false,
        tags: [
          'Cardapio digital',
          serviceType === 'delivery' ? 'Delivery' : 'Retirada',
          ...(deliveryPricing?.neighborhood ? [`Bairro: ${deliveryPricing.neighborhood}`] : []),
          ...(promotionAdjustment.promotionName
            ? [`Promocao: ${promotionAdjustment.promotionName}`]
            : []),
        ],
        addressLabel: address?.label,
        addressText: address ? formatAddressText(address) : undefined,
        deliveryLatitude: deliveryCoordinate?.latitude,
        deliveryLongitude: deliveryCoordinate?.longitude,
        notes: payload.notes,
        items: {
          create: items.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
            options: toProductOptionsJson(item.options),
          })),
        },
        history: {
          create: [
            {
              status: 'in_analysis',
              label: 'Pedido recebido pelo cardapio digital',
              actor: 'Cliente',
              createdAt,
            },
            {
              status,
              label: 'Checkout publico validado e enviado para producao',
              actor: 'Sistema',
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

      await this.printingPolicy.createOrderJobs(transaction, {
        storeId: getCurrentStoreId(),
        eventId: `order-created:${orderId}`,
        jobType: 'ORDER_INITIAL',
        order: createdOrder,
        items: createdOrder.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toNumber(),
        })),
      })

      const tracking =
        !this.features || this.features.isEnabled('publicTracking')
          ? await this.publicTracking.issueInTransaction(
              transaction,
              getCurrentStoreId(),
              createdOrder.id,
            )
          : null

      return { order: createdOrder, tracking }
    })
    const { order, tracking } = result

    this.realtime.emit('order.created', {
      orderId: order.id,
    })
    this.realtime.emit('order.status_changed', {
      orderId: order.id,
      status: order.status,
      driverId: null,
    })

    return {
      data: mapOrder(order),
      tracking,
    }
  }

  async updateStatus(
    orderId: string,
    payload: UpdateOrderStatusPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    const current = await this.prisma.order.findFirstOrThrow({
      where: {
        id: orderId,
        storeId: getCurrentStoreId(),
      },
      include: {
        items: true,
        history: true,
        driver: true,
      },
    })
    let transition: ReturnType<typeof resolveOrderTransition>

    try {
      transition = resolveOrderTransition({
        currentStatus: current.status,
        action: payload.action,
        source: current.source,
        serviceType: current.serviceType,
        paymentMethod: current.paymentMethod,
        paymentStatus: current.paymentStatus,
        assignedDriverId: current.driverId,
        requestedDriverId: payload.driverId,
        actor: {
          userId: authUser.sub,
          role: authUser.role,
        },
        dueAt: current.dueAt,
      })
    } catch (error) {
      if (error instanceof OrderTransitionError) {
        throw new ConflictException({ code: error.code, message: error.message })
      }

      throw error
    }

    if (transition.idempotent) {
      if (['dispatch', 'complete', 'cancel'].includes(payload.action)) {
        await this.syncDriverAvailability(current.driverId)
        await this.syncDeliveryAssignment({
          action: payload.action,
          orderId: current.id,
          driverId: current.driverId,
        })
      }

      return { data: mapOrder(current) }
    }

    const nextStatus = transition.nextStatus
    const nextDriverId =
      payload.action === 'dispatch'
        ? await this.resolveDriverAssignment(current.serviceType, payload.driverId)
        : current.driverId
    const transitionEventId = randomUUID()

    const order = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: {
          id: current.id,
          storeId: getCurrentStoreId(),
          status: current.status,
        },
        data: {
          status: nextStatus,
          driverId: nextDriverId,
          tags:
            payload.action === 'cancel' && !current.tags.includes('Cancelado')
              ? [...current.tags, 'Cancelado']
              : current.tags,
        },
      })

      if (changed.count !== 1) {
        throw new ConflictException('O pedido foi atualizado por outra requisicao.')
      }

      await transaction.orderStatusHistory.create({
        data: {
          id: transitionEventId,
          orderId: current.id,
          status: nextStatus,
          label: this.cleanDatabaseText(this.actionLabel(payload.action)),
          actor: this.cleanDatabaseText(authUser.name),
        },
      })

      const notificationType = notificationTypeForStatus(nextStatus)
      if (current.source === 'whatsapp' && notificationType) {
        await transaction.orderNotification.upsert({
          where: {
            orderId_type: { orderId: current.id, type: notificationType },
          },
          create: {
            storeId: getCurrentStoreId(),
            orderId: current.id,
            type: notificationType,
            idempotencyKey: `order:${current.id}:${notificationType.toLowerCase()}`,
          },
          update: {},
        })
      }

      if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        await transaction.publicTrackingToken.updateMany({
          where: { orderId: current.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      }

      const updatedOrder = await transaction.order.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          items: true,
          history: true,
          driver: true,
        },
      })

      if (nextStatus === 'in_preparation') {
        await this.printingPolicy.createOrderJobs(transaction, {
          storeId: getCurrentStoreId(),
          eventId: transitionEventId,
          jobType: 'ORDER_INITIAL',
          order: updatedOrder,
          items: updatedOrder.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toNumber(),
          })),
        })
      } else if (nextStatus === 'ready') {
        await this.printingPolicy.createOperationalJob(transaction, {
          storeId: getCurrentStoreId(),
          eventId: transitionEventId,
          jobType: 'DISPATCH_ORDER',
          stationCode: 'EXPEDICAO',
          order: updatedOrder,
          items: updatedOrder.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toNumber(),
          })),
        })
      } else if (nextStatus === 'cancelled') {
        await this.printingPolicy.createOrderJobs(transaction, {
          storeId: getCurrentStoreId(),
          eventId: transitionEventId,
          jobType: 'ORDER_CANCELLATION',
          order: updatedOrder,
          items: updatedOrder.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toNumber(),
          })),
        })
      }

      return updatedOrder
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
          storeId: getCurrentStoreId(),
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

  async repeatOrder(
    orderId: string,
    payload: RepeatOrderPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    const current = await this.prisma.order.findFirstOrThrow({
      where: {
        id: orderId,
        storeId: getCurrentStoreId(),
      },
      include: {
        items: true,
        customer: {
          include: {
            addresses: true,
          },
        },
      },
    })
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: getCurrentStoreId() },
    })
    const paymentMethod = await this.prisma.paymentMethodConfig.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        method: payload.paymentMethod,
        active: true,
      },
    })

    if (!paymentMethod) {
      throw new BadRequestException('Forma de pagamento indisponivel para o novo pedido.')
    }

    const catalogChannel = resolveCatalogChannel(current.serviceType)
    const items = await this.resolveRepeatPricedItems(
      current.items,
      catalogChannel,
      channelLabelMap[current.serviceType],
    )
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    )
    const promotionAdjustment = await this.resolvePromotionAdjustment(catalogChannel, items)
    const discount = promotionAdjustment.discount
    const address =
      current.customer?.addresses.find((entry) => entry.label === current.addressLabel) ??
      current.customer?.addresses[0] ??
      null
    const deliveryPricing =
      current.serviceType === 'delivery' && address?.district
        ? await this.resolveDeliveryPricing(address.district, store)
        : null
    const deliveryFee =
      current.serviceType === 'delivery'
        ? (deliveryPricing?.fee ?? store.defaultDeliveryFee.toNumber())
        : 0
    const estimatedPrepTimeMinutes = this.getEstimatedPrepTime(store, current.serviceType)
    const estimatedDeliveryTimeMinutes =
      current.serviceType === 'delivery'
        ? (deliveryPricing?.estimatedDeliveryTimeMinutes ?? store.estimatedDeliveryTimeMinutes)
        : null
    const estimatedTotalTimeMinutes =
      estimatedPrepTimeMinutes + (estimatedDeliveryTimeMinutes ?? 0)
    const number = await this.nextOrderNumber()

    const order = await this.prisma.order.create({
      data: {
        storeId: getCurrentStoreId(),
        number,
        customerId: current.customerId,
        customerName: current.customerName,
        customerPhone: current.customerPhone,
        source: current.source,
        serviceType: current.serviceType,
        status: 'in_analysis',
        paymentMethod: payload.paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        deliveryFee,
        discount,
        couponCode: null,
        promotionName: promotionAdjustment.promotionName,
        discountBreakdown: this.buildDiscountBreakdown(
          subtotal,
          promotionAdjustment,
          { discount: 0 },
        ),
        total: Math.max(0, subtotal - discount) + deliveryFee,
        dueAt: new Date(Date.now() + estimatedTotalTimeMinutes * 60 * 1000),
        estimatedPrepTimeMinutes,
        estimatedDeliveryTimeMinutes,
        estimatedTotalTimeMinutes,
        priority: 'normal',
        delayed: false,
        tags: [
          channelLabelMap[current.serviceType],
          'Pedido repetido com catalogo atual',
          ...(promotionAdjustment.promotionName
            ? [`Promocao: ${promotionAdjustment.promotionName}`]
            : []),
        ],
        addressLabel: current.addressLabel,
        addressText: current.addressText,
        deliveryLatitude: current.deliveryLatitude,
        deliveryLongitude: current.deliveryLongitude,
        tableCode: current.tableCode,
        notes: null,
        driverId: null,
        items: {
          create: items.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: null,
            options: toProductOptionsJson(item.options),
          })),
        },
        history: {
          create: {
            status: 'in_analysis',
            label: 'Pedido recriado a partir do historico',
            actor: this.cleanDatabaseText(authUser.name),
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

  async confirmPayment(
    orderId: string,
    payload: ConfirmOrderPaymentPayload,
    authUser: AuthenticatedRequestUser,
  ) {
    const current = await this.prisma.order.findFirst({
      where: { id: orderId, storeId: getCurrentStoreId() },
      include: { items: true, history: true, driver: true },
    })

    if (!current) {
      throw new NotFoundException('Pedido nao encontrado.')
    }

    if (current.paymentStatus === payload.status) {
      return { data: mapOrder(current) }
    }

    if (!canTransitionPayment(current.paymentStatus, payload.status)) {
      throw new ConflictException({
        code: 'INVALID_PAYMENT_TRANSITION',
        message: `Transicao de pagamento ${current.paymentStatus} para ${payload.status} nao permitida.`,
      })
    }

    const paymentEventId = randomUUID()
    const order = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: {
          id: current.id,
          storeId: getCurrentStoreId(),
          paymentStatus: current.paymentStatus,
        },
        data: { paymentStatus: payload.status },
      })

      if (changed.count !== 1) {
        throw new ConflictException('O pagamento foi atualizado por outra requisicao.')
      }

      const cashRegister = await transaction.cashRegister.findFirst({
        where: {
          storeId: getCurrentStoreId(),
          status: 'open',
        },
        orderBy: {
          openedAt: 'desc',
        },
      })

      if (
        current.paymentMethod === 'cash' &&
        (payload.status === 'paid' || payload.status === 'refunded') &&
        !cashRegister
      ) {
        throw new ConflictException(
          'Abra um caixa antes de confirmar pagamento ou reembolso em dinheiro.',
        )
      }

      await transaction.paymentAudit.create({
        data: {
          id: paymentEventId,
          storeId: getCurrentStoreId(),
          orderId: current.id,
          status: payload.status,
          amount: current.total,
          method: current.paymentMethod,
          source: 'manual',
          actorId: authUser.sub,
          actorName: this.cleanDatabaseText(authUser.name),
          externalReference: payload.externalReference,
          cashRegisterId: cashRegister?.id,
        },
      })

      await transaction.orderStatusHistory.create({
        data: {
          orderId: current.id,
          status: current.status,
          label: `Pagamento atualizado para ${payload.status}`,
          actor: this.cleanDatabaseText(authUser.name),
        },
      })

      const updatedOrder = await transaction.order.findUniqueOrThrow({
        where: { id: current.id },
        include: { items: true, history: true, driver: true },
      })

      if (payload.status === 'paid') {
        await this.printingPolicy.createPaymentJobs(transaction, {
          storeId: getCurrentStoreId(),
          eventId: paymentEventId,
          order: updatedOrder,
          items: updatedOrder.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toNumber(),
          })),
        })
      }

      if (payload.status === 'paid' && cashRegister) {
        await this.registerSaleMovement(transaction, cashRegister, {
          orderId: current.id,
          orderNumber: current.number,
          amount: current.total,
          method: current.paymentMethod,
          paymentAuditId: paymentEventId,
          actor: authUser,
        })
      }

      if (payload.status === 'refunded' && current.paymentMethod === 'cash' && cashRegister) {
        await this.registerRefundMovement(transaction, cashRegister, {
          orderId: current.id,
          orderNumber: current.number,
          amount: current.total,
          paymentAuditId: paymentEventId,
          reason: payload.reason ?? '',
          actor: authUser,
        })
      }

      return updatedOrder
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return { data: mapOrder(order) }
  }

  private async resolvePricedItems(
    payloadItems: OrderItemSelectionInput[],
    catalogChannel: ProductChannel,
    channelLabel: string,
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: payloadItems.map((item) => item.productId),
        },
        storeId: getCurrentStoreId(),
      },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    return payloadItems.map((item): PricedOrderItem => {
      const product = products.find((entry) => entry.id === item.productId)

      if (!product) {
        throw new NotFoundException(`Produto ${item.productId} nao encontrado.`)
      }

      const availability = product.availability.find((entry) => entry.channel === catalogChannel)

      if (!product.active || !availability?.visible || !availability.available || availability.soldOut) {
        throw new BadRequestException(
          `Produto ${product.name} indisponivel para ${channelLabel}.`,
        )
      }

      const selectedOptions = resolveProductOptionSelection(product, item.options ?? [])
      const basePrice = availability.priceOverride?.toNumber() ?? product.price.toNumber()

      return {
        product,
        quantity: item.quantity,
        unitPrice: basePrice + selectedOptions.optionsTotal,
        notes: item.notes,
        options: selectedOptions.options,
      }
    })
  }

  private async resolveRepeatPricedItems(
    historicalItems: OrderItem[],
    catalogChannel: ProductChannel,
    channelLabel: string,
  ) {
    const extracted = extractRepeatItemSelections(historicalItems)
    const productIds = historicalItems.flatMap((item) =>
      item.productId ? [item.productId] : [],
    )
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: getCurrentStoreId(),
      },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: { options: true },
            },
          },
        },
      },
    })
    const issues: Array<{
      orderItemId: string
      productId: string | null
      itemName: string
      reason: string
    }> = [...extracted.issues]
    const priced: PricedOrderItem[] = []

    for (const item of historicalItems) {
      const selection = extracted.selections.find(
        (entry) => entry.orderItemId === item.id,
      )
      if (!selection) {
        continue
      }

      const product = products.find((entry) => entry.id === item.productId)

      if (!product) {
        issues.push({
          orderItemId: item.id,
          productId: item.productId,
          itemName: item.name,
          reason: 'Produto removido do catalogo atual.',
        })
        continue
      }

      const availability = product.availability.find(
        (entry) => entry.channel === catalogChannel,
      )

      if (
        !product.active ||
        !availability?.visible ||
        !availability.available ||
        availability.soldOut
      ) {
        issues.push({
          orderItemId: item.id,
          productId: item.productId,
          itemName: item.name,
          reason: `Produto indisponivel para ${channelLabel}.`,
        })
        continue
      }

      try {
        const resolvedOptions = resolveProductOptionSelection(product, selection.options)
        const basePrice = availability.priceOverride?.toNumber() ?? product.price.toNumber()

        priced.push({
          product,
          quantity: item.quantity,
          unitPrice: basePrice + resolvedOptions.optionsTotal,
          options: resolvedOptions.options,
        })
      } catch (error) {
        issues.push({
          orderItemId: item.id,
          productId: item.productId,
          itemName: item.name,
          reason:
            error instanceof Error
              ? error.message
              : 'Adicionais precisam ser revisados no catalogo atual.',
        })
      }
    }

    if (issues.length) {
      throw new UnprocessableEntityException({
        code: 'ORDER_REPEAT_REVIEW_REQUIRED',
        message: 'Alguns itens precisam ser revisados antes de repetir o pedido.',
        items: issues,
      })
    }

    return priced
  }

  private async upsertPublicCustomer(payload: { name: string; phone: string }) {
    const current = await this.prisma.customer.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        phone: payload.phone,
      },
    })

    if (current) {
      return this.prisma.customer.update({
        where: {
          id: current.id,
        },
        data: {
          name: payload.name.trim(),
          phone: payload.phone,
        },
      })
    }

    return this.prisma.customer.create({
      data: {
        storeId: getCurrentStoreId(),
        name: payload.name.trim(),
        phone: payload.phone,
        tags: ['Cardapio digital'],
      },
    })
  }

  private async upsertPublicAddress(
    customerId: string,
    payload: CreatePublicOrderPayload,
    store: { city: string; state: string },
  ) {
    const street = payload.address?.trim()
    const district = payload.neighborhood?.trim()

    if (!street || !district) {
      throw new BadRequestException('Informe endereco e bairro para delivery.')
    }

    const current = await this.prisma.customerAddress.findFirst({
      where: {
        customerId,
        street,
        district,
      },
    })
    const data = {
      label: 'Cardapio digital',
      street,
      number: 'S/N',
      district,
      complement: payload.complement?.trim() || null,
      reference: payload.reference?.trim() || null,
      city: store.city,
      state: store.state,
    }

    if (current) {
      return this.prisma.customerAddress.update({
        where: {
          id: current.id,
        },
        data,
      })
    }

    return this.prisma.customerAddress.create({
      data: {
        customerId,
        ...data,
      },
    })
  }

  private async resolveDeliveryPricing(
    neighborhood: string,
    store: {
      id: string
      defaultDeliveryFee: Prisma.Decimal
      estimatedDeliveryTimeMinutes: number
    },
  ): Promise<DeliveryPricingResult> {
    const requestedNeighborhood = neighborhood.trim()
    if (!requestedNeighborhood) {
      throw new BadRequestException('Informe o bairro para delivery.')
    }

    const zones = await this.prisma.deliveryZone.findMany({
      where: {
        storeId: store.id,
      },
    })
    const activeZones = zones.filter((zone) => zone.active)

    if (!activeZones.length) {
      return {
        fee: store.defaultDeliveryFee.toNumber(),
        estimatedDeliveryTimeMinutes: store.estimatedDeliveryTimeMinutes,
        neighborhood: requestedNeighborhood,
      }
    }

    const zone = activeZones.find(
      (entry) => normalizeText(entry.neighborhood) === normalizeText(requestedNeighborhood),
    )

    if (!zone) {
      throw new BadRequestException(
        'Bairro nao atendido pelo cardapio digital. Chame a loja no WhatsApp para confirmar.',
      )
    }

    return {
      zoneId: zone.id,
      neighborhood: zone.neighborhood,
      fee: zone.fee.toNumber(),
      estimatedDeliveryTimeMinutes:
        zone.estimatedDeliveryTimeMinutes ?? store.estimatedDeliveryTimeMinutes,
    }
  }

  private async resolvePromotionAdjustment(
    channel: ProductChannel,
    items: PricedOrderItem[],
  ): Promise<PromotionAdjustment> {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        storeId: getCurrentStoreId(),
        status: 'active',
        type: 'combo',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
    const now = new Date()
    const candidates = promotions
      .filter((promotion) => {
        const channelAllowed = !promotion.channels.length || promotion.channels.includes(channel)
        const dateAllowed =
          (!promotion.startsAt || promotion.startsAt <= now) &&
          (!promotion.endsAt || promotion.endsAt >= now)

        return channelAllowed && dateAllowed
      })
      .map((promotion) => this.calculateComboPromotionDiscount(promotion, items))
      .filter((adjustment): adjustment is PromotionAdjustment => Boolean(adjustment))
      .filter((adjustment) => adjustment.discount > 0)
      .sort((left, right) => right.discount - left.discount)

    return candidates[0] ?? { discount: 0 }
  }

  private calculateComboPromotionDiscount(
    promotion: Prisma.PromotionGetPayload<Record<string, never>>,
    items: PricedOrderItem[],
  ): PromotionAdjustment | null {
    const rules = readPromotionRules(promotion.rules)
    const finalPrice = rules?.finalPrice ?? promotion.discountValue?.toNumber()
    const requiredItems = rules?.requiredItems ?? 0

    if (!rules || !finalPrice || requiredItems <= 0) {
      return null
    }

    const participantIds =
      rules.participantId
        ? [rules.participantId]
        : rules.participantType === 'category'
          ? promotion.categoryIds
          : promotion.productIds
    const eligibleUnits = items
      .filter((item) => {
        const participantAllowed =
          participantIds.length === 0 ||
          (rules.participantType === 'category'
            ? participantIds.includes(item.product.categoryId)
            : participantIds.includes(item.product.id))
        const sizeAllowed =
          !rules.sizeLabel ||
          normalizeText(`${item.product.name} ${item.product.description}`).includes(
            normalizeText(rules.sizeLabel),
          )
        const flavorAllowed =
          rules.flavorLimitPerItem === undefined ||
          countFlavorOptions(item.options) <= rules.flavorLimitPerItem

        return participantAllowed && sizeAllowed && flavorAllowed
      })
      .flatMap((item) => Array.from({ length: item.quantity }, () => item.unitPrice))
      .sort((left, right) => right - left)

    const applicationCount = Math.floor(eligibleUnits.length / requiredItems)
    if (!applicationCount) {
      return null
    }

    let discount = 0
    for (let index = 0; index < applicationCount; index += 1) {
      const start = index * requiredItems
      const selectedTotal = eligibleUnits
        .slice(start, start + requiredItems)
        .reduce((sum, unitPrice) => sum + unitPrice, 0)
      discount += Math.max(0, selectedTotal - finalPrice)
    }

    return {
      promotionId: promotion.id,
      promotionName: promotion.name,
      discount: roundMoney(discount),
    }
  }

  private async resolveCouponAdjustment(
    code: string,
    channel: ProductChannel,
    orderTotal: number,
  ): Promise<CouponAdjustment> {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        code: code.trim().toUpperCase(),
      },
    })

    if (!coupon) {
      throw new BadRequestException('Cupom nao encontrado.')
    }

    if (coupon.status !== 'active') {
      throw new BadRequestException('Cupom inativo.')
    }

    const now = new Date()
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Cupom ainda nao esta valido.')
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException('Cupom expirado.')
    }

    if (coupon.channels.length && !coupon.channels.includes(channel)) {
      throw new BadRequestException('Cupom invalido para este canal.')
    }

    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      throw new BadRequestException('Cupom atingiu o limite de uso.')
    }

    const minOrderAmount = coupon.minOrderAmount.toNumber()
    if (orderTotal < minOrderAmount) {
      throw new BadRequestException('Pedido minimo nao atingido.')
    }

    const value = coupon.value.toNumber()
    const discount =
      coupon.type === 'percent'
        ? Math.min(orderTotal, (orderTotal * value) / 100)
        : Math.min(orderTotal, value)

    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      discount: roundMoney(discount),
    }
  }

  private buildDiscountBreakdown(
    subtotal: number,
    promotion: PromotionAdjustment,
    coupon: CouponAdjustment,
  ): Prisma.InputJsonObject | undefined {
    if (!promotion.discount && !coupon.discount) {
      return undefined
    }

    return {
      subtotalBeforeDiscount: roundMoney(subtotal),
      promotionId: promotion.promotionId,
      promotionName: promotion.promotionName,
      promotionDiscount: roundMoney(promotion.discount),
      couponCode: coupon.couponCode,
      couponDiscount: roundMoney(coupon.discount),
    }
  }

  private buildWhere(query: ListOrdersQuery): Prisma.OrderWhereInput {
    const search = query.search?.trim()

    return {
      storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
      },
    })

    return `#${1001 + count}`
  }

  private actionLabel(action: UpdateOrderStatusPayload['action']) {
    if (action === 'accept') {
      return 'Pedido aceito e enviado para producao'
    }

    const targetByAction: Record<UpdateOrderStatusPayload['action'], OrderStatus> = {
      accept: 'in_preparation',
      start_preparation: 'in_preparation',
      ready: 'ready',
      dispatch: 'out_for_delivery',
      complete: 'completed',
      cancel: 'cancelled',
    }

    return statusLabelMap[targetByAction[action]]
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
        storeId: getCurrentStoreId(),
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

    return driver.userId
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
        storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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
          storeId: getCurrentStoreId(),
          userId: params.driverId,
          role: 'driver',
        },
      })

      if (!membership) {
        return
      }

      const activeAssignments = await this.prisma.deliveryAssignment.count({
        where: {
          storeId: getCurrentStoreId(),
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
          storeId: getCurrentStoreId(),
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
          storeId: getCurrentStoreId(),
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
    transaction: Prisma.TransactionClient,
    register: Prisma.CashRegisterGetPayload<Record<string, never>>,
    input: {
      orderId: string
      orderNumber: string
      amount: Prisma.Decimal
      method: CreateOrderPayload['paymentMethod']
      paymentAuditId: string
      actor: AuthenticatedRequestUser
    },
  ) {
    if (input.method !== 'cash') {
      return
    }

    const idempotencyKey = `cash-sale:${input.orderId}`
    const existingMovement = await transaction.cashMovement.findFirst({
      where: {
        cashRegisterId: register.id,
        storeId: getCurrentStoreId(),
        orderId: input.orderId,
        type: 'CASH_SALE',
      },
    })

    if (existingMovement) {
      return
    }

    const changed = await transaction.cashRegister.updateMany({
      where: {
        id: register.id,
        storeId: getCurrentStoreId(),
        status: 'open',
        expectedAmount: register.expectedAmount,
      },
      data: {
        expectedAmount: {
          increment: input.amount,
        },
      },
    })

    if (changed.count !== 1) {
      throw new ConflictException('O caixa foi alterado durante a confirmacao do pagamento.')
    }

    const movement = await transaction.cashMovement.create({
      data: {
        storeId: getCurrentStoreId(),
        cashRegisterId: register.id,
        type: 'CASH_SALE',
        method: 'cash',
        amount: input.amount,
        label: `Venda em dinheiro - Pedido ${input.orderNumber}`,
        reason: `Pagamento em dinheiro confirmado para o pedido ${input.orderNumber}`,
        userName: this.cleanDatabaseText(input.actor.name),
        operatorUserId: input.actor.sub,
        operatorName: this.cleanDatabaseText(input.actor.name),
        balanceBefore: register.expectedAmount,
        balanceAfter: register.expectedAmount.plus(input.amount),
        idempotencyKey,
        orderId: input.orderId,
        paymentAuditId: input.paymentAuditId,
      },
    })

    await transaction.cashAuditLog.create({
      data: {
        storeId: getCurrentStoreId(),
        cashRegisterId: register.id,
        cashMovementId: movement.id,
        action: 'cash_movement.sale',
        actorUserId: input.actor.sub,
        actorName: this.cleanDatabaseText(input.actor.name),
        idempotencyKey,
        metadata: {
          orderId: input.orderId,
          paymentAuditId: input.paymentAuditId,
          amount: input.amount.toString(),
        },
      },
    })
  }

  private async registerRefundMovement(
    transaction: Prisma.TransactionClient,
    register: Prisma.CashRegisterGetPayload<Record<string, never>>,
    input: {
      orderId: string
      orderNumber: string
      amount: Prisma.Decimal
      paymentAuditId: string
      reason: string
      actor: AuthenticatedRequestUser
    },
  ) {
    if (!input.reason.trim()) {
      throw new BadRequestException('Informe o motivo do reembolso em dinheiro.')
    }

    const previousRefunds = await transaction.cashMovement.aggregate({
      where: {
        storeId: getCurrentStoreId(),
        orderId: input.orderId,
        type: 'CASH_REFUND',
      },
      _sum: { amount: true },
    })

    if (new Prisma.Decimal(previousRefunds._sum.amount ?? 0).plus(input.amount).greaterThan(input.amount)) {
      throw new BadRequestException('Reembolso excede o valor recebido em dinheiro.')
    }

    if (register.expectedAmount.lessThan(input.amount)) {
      throw new BadRequestException('Saldo esperado insuficiente para o reembolso em dinheiro.')
    }

    const changed = await transaction.cashRegister.updateMany({
      where: {
        id: register.id,
        storeId: getCurrentStoreId(),
        status: 'open',
        expectedAmount: register.expectedAmount,
      },
      data: {
        expectedAmount: { decrement: input.amount },
      },
    })

    if (changed.count !== 1) {
      throw new ConflictException('O caixa foi alterado durante o reembolso.')
    }

    const idempotencyKey = `cash-refund:${input.orderId}`
    const movement = await transaction.cashMovement.create({
      data: {
        storeId: getCurrentStoreId(),
        cashRegisterId: register.id,
        type: 'CASH_REFUND',
        method: 'cash',
        amount: input.amount,
        label: `Reembolso em dinheiro - Pedido ${input.orderNumber}`,
        reason: input.reason.trim(),
        userName: this.cleanDatabaseText(input.actor.name),
        operatorUserId: input.actor.sub,
        operatorName: this.cleanDatabaseText(input.actor.name),
        balanceBefore: register.expectedAmount,
        balanceAfter: register.expectedAmount.minus(input.amount),
        idempotencyKey,
        orderId: input.orderId,
        paymentAuditId: input.paymentAuditId,
      },
    })

    await transaction.cashAuditLog.create({
      data: {
        storeId: getCurrentStoreId(),
        cashRegisterId: register.id,
        cashMovementId: movement.id,
        action: 'cash_movement.refund',
        actorUserId: input.actor.sub,
        actorName: this.cleanDatabaseText(input.actor.name),
        idempotencyKey,
        metadata: {
          orderId: input.orderId,
          paymentAuditId: input.paymentAuditId,
          amount: input.amount.toString(),
          reason: input.reason.trim(),
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

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length < 10) {
    throw new BadRequestException('Informe um WhatsApp valido para o pedido.')
  }

  if (digits.startsWith('55')) {
    return `+${digits}`
  }

  return `+55${digits}`
}

function formatAddressText(address: {
  street: string
  number: string
  district: string
  complement: string | null
  reference: string | null
}) {
  return [
    `${address.street}, ${address.number} - ${address.district}`,
    address.complement ? `Complemento: ${address.complement}` : null,
    address.reference ? `Referencia: ${address.reference}` : null,
  ]
    .filter((entry): entry is string => entry !== null)
    .join(' | ')
}

function notificationTypeForStatus(status: OrderStatus): OrderNotificationType | null {
  if (status === 'in_preparation') return 'ORDER_PREPARING'
  if (status === 'out_for_delivery') return 'ORDER_OUT_FOR_DELIVERY'
  if (status === 'completed') return 'ORDER_DELIVERED'
  if (status === 'cancelled') return 'ORDER_CANCELLED'
  return null
}

function roundCoordinate(value: number) {
  return Math.round(value * 10000) / 10000
}

function resolveCatalogChannel(channel: OrderChannel): ProductChannel {
  if (channel === 'dine_in') {
    return 'dine_in'
  }

  if (channel === 'counter' || channel === 'pickup') {
    return 'counter'
  }

  if (channel === 'digital_menu') {
    return 'digital_menu'
  }

  return 'delivery'
}

function readPromotionRules(value: Prisma.JsonValue | null): PromotionRuleConfig | null {
  if (!isJsonObject(value)) {
    return null
  }

  const requiredItems = readNumber(value.requiredItems)
  const participantType =
    value.participantType === 'product' || value.participantType === 'category'
      ? value.participantType
      : 'category'

  if (!requiredItems) {
    return null
  }

  return {
    requiredItems,
    participantType,
    participantId: readString(value.participantId),
    sizeLabel: readString(value.sizeLabel),
    flavorLimitPerItem: readNumber(value.flavorLimitPerItem),
    finalPrice: readNumber(value.finalPrice),
  }
}

function isJsonObject(value: Prisma.JsonValue | null): value is Record<string, Prisma.JsonValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readNumber(value: Prisma.JsonValue | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readString(value: Prisma.JsonValue | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function countFlavorOptions(options: ResolvedProductOption[]) {
  return options
    .filter((option) => normalizeText(option.groupName).includes('sabor'))
    .reduce((sum, option) => sum + option.quantity, 0)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function routeGeometryToJson(geometry: GeoCoordinate[]): Prisma.InputJsonValue {
  return {
    coordinates: geometry.map((point) => [point.longitude, point.latitude]),
  } as Prisma.InputJsonValue
}
