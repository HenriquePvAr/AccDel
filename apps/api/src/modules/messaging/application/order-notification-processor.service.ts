import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { OrderNotificationType } from '@prisma/client'

import { PublicTrackingService } from '@/modules/tracking/public-tracking.service'
import { PrismaService } from '@/shared/prisma/prisma.service'

import { ConversationWindowService } from './conversation-window.service'
import { MessagingAccountService } from './messaging-account.service'
import { MessagingOutboxService } from './messaging-outbox.service'

@Injectable()
export class OrderNotificationProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderNotificationProcessorService.name)
  private interval?: NodeJS.Timeout
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly window: ConversationWindowService,
    private readonly accounts: MessagingAccountService,
    private readonly outbox: MessagingOutboxService,
    private readonly tracking: PublicTrackingService,
  ) {}

  onModuleInit() {
    if (!this.config.get<string>('WHATSAPP_PROVIDER')?.trim()) return
    this.interval = setInterval(() => void this.tick(), 1_500)
    this.interval.unref()
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval)
  }

  async tick() {
    if (this.running) return
    this.running = true
    try {
      for (let index = 0; index < 10; index += 1) {
        const notification = await this.claimNext()
        if (!notification) break
        await this.process(notification.id)
      }
    } finally {
      this.running = false
    }
  }

  private async claimNext() {
    const stale = new Date(Date.now() - 5 * 60_000)
    const candidate = await this.prisma.orderNotification.findFirst({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', processedAt: { lt: stale } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })
    if (!candidate) return null
    const claimedAt = new Date()
    const claimed = await this.prisma.orderNotification.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        processedAt: candidate.processedAt,
      },
      data: { status: 'PROCESSING', processedAt: claimedAt },
    })
    return claimed.count === 1
      ? this.prisma.orderNotification.findUnique({ where: { id: candidate.id } })
      : null
  }

  private async process(notificationId: string) {
    const notification = await this.prisma.orderNotification.findUnique({
      where: { id: notificationId },
      include: { order: true, account: true, conversation: true },
    })
    if (!notification) return

    try {
      const existingOutbound = await this.prisma.outboundMessage.findUnique({
        where: {
          storeId_idempotencyKey: {
            storeId: notification.storeId,
            idempotencyKey: `notification:${notification.id}`,
          },
        },
      })
      if (existingOutbound) {
        await this.markQueued(notification.id, notification.templateName)
        return
      }

      const account =
        notification.account ??
        (await this.accounts.getEnabledForStore(notification.storeId))
      if (!account || !notification.order.customerPhone) {
        throw new Error('notification_recipient_unavailable')
      }
      const conversation =
        notification.conversation ??
        (await this.prisma.aiConversation.findFirst({
          where: {
            storeId: notification.storeId,
            messagingAccountId: account.id,
            ...(notification.order.customerId
              ? { customerId: notification.order.customerId }
              : { whatsappNumber: notification.order.customerPhone.replace(/\D/g, '') }),
          },
          orderBy: { lastMessageAt: 'desc' },
        }))
      const trackingUrl =
        notification.type === 'ORDER_OUT_FOR_DELIVERY'
          ? (await this.tracking.issue(notification.storeId, notification.orderId)).url
          : null
      const canUseFreeForm = Boolean(conversation && this.window.isFreeFormAllowed(conversation))

      if (canUseFreeForm && conversation) {
        await this.outbox.enqueueText({
          storeId: notification.storeId,
          accountId: account.id,
          conversationId: conversation.id,
          orderId: notification.orderId,
          notificationId: notification.id,
          recipient: notification.order.customerPhone,
          body: notificationText(notification.type, notification.order.number, trackingUrl),
          idempotencyKey: `notification:${notification.id}`,
          senderType: 'system',
        })
        await this.markQueued(notification.id, null)
        return
      }

      const templateName = this.templateName(notification.type)
      if (!templateName) throw new Error('approved_template_not_configured')
      const parameters = [notification.order.number, ...(trackingUrl ? [trackingUrl] : [])]
      await this.outbox.enqueueTemplate({
        storeId: notification.storeId,
        accountId: account.id,
        conversationId: conversation?.id,
        orderId: notification.orderId,
        notificationId: notification.id,
        recipient: notification.order.customerPhone,
        templateName,
        languageCode: this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE')?.trim() || 'pt_BR',
        components: [{
          type: 'body',
          parameters: parameters.map((text) => ({ type: 'text', text })),
        }],
        idempotencyKey: `notification:${notification.id}`,
        senderType: 'system',
      })
      await this.markQueued(notification.id, templateName)
    } catch (error) {
      const code = error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) : 'unknown'
      await this.prisma.orderNotification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', processedAt: new Date(), lastError: code },
      })
      this.logger.warn(`Notificacao ${notification.id} falhou com ${code}.`)
    }
  }

  private markQueued(id: string, templateName: string | null) {
    return this.prisma.orderNotification.update({
      where: { id },
      data: {
        status: 'QUEUED',
        processedAt: new Date(),
        templateName,
        lastError: null,
      },
    })
  }

  private templateName(type: OrderNotificationType) {
    const envByType: Record<OrderNotificationType, string> = {
      ORDER_CONFIRMED: 'WHATSAPP_TEMPLATE_ORDER_CONFIRMED',
      ORDER_PREPARING: 'WHATSAPP_TEMPLATE_ORDER_PREPARING',
      ORDER_OUT_FOR_DELIVERY: 'WHATSAPP_TEMPLATE_ORDER_OUT_FOR_DELIVERY',
      ORDER_DELIVERED: 'WHATSAPP_TEMPLATE_ORDER_DELIVERED',
      ORDER_CANCELLED: 'WHATSAPP_TEMPLATE_ORDER_CANCELLED',
    }
    return this.config.get<string>(envByType[type])?.trim() || null
  }
}

function notificationText(type: OrderNotificationType, orderNumber: string, trackingUrl: string | null) {
  const textByType: Record<OrderNotificationType, string> = {
    ORDER_CONFIRMED: `Pedido ${orderNumber} confirmado e recebido pela loja.`,
    ORDER_PREPARING: `Pedido ${orderNumber} entrou em preparo.`,
    ORDER_OUT_FOR_DELIVERY: `Pedido ${orderNumber} saiu para entrega.${trackingUrl ? ` Acompanhe: ${trackingUrl}` : ''}`,
    ORDER_DELIVERED: `Pedido ${orderNumber} foi entregue. Obrigado!`,
    ORDER_CANCELLED: `Pedido ${orderNumber} foi cancelado. Fale com a equipe se precisar de ajuda.`,
  }
  return textByType[type]
}
