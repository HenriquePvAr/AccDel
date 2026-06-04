import { Injectable } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

import type { AiReplyResult } from './ai-provider.adapter'

type OrderStatusLookupOrder = Prisma.OrderGetPayload<{
  include: {
    driver: {
      select: {
        name: true
      }
    }
    items: {
      select: {
        name: true
        quantity: true
      }
    }
    history: {
      orderBy: {
        createdAt: 'desc'
      }
      take: 3
      select: {
        status: true
        label: true
        createdAt: true
      }
    }
    deliveryAssignments: {
      orderBy: {
        assignedAt: 'desc'
      }
      take: 1
      select: {
        status: true
        assignedAt: true
        completedAt: true
        driver: {
          select: {
            name: true
          }
        }
      }
    }
    etaSnapshots: {
      orderBy: {
        createdAt: 'desc'
      }
      take: 1
      select: {
        etaMinutes: true
        distanceMeters: true
        message: true
        createdAt: true
      }
    }
  }
}>

interface ResolveOrderStatusInput {
  storeId: string
  message: string
  customerPhone?: string | null
}

@Injectable()
export class AiOrderStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: ResolveOrderStatusInput): Promise<AiReplyResult | null> {
    if (!this.isOrderStatusIntent(input.message)) {
      return null
    }

    const orderNumber = this.extractOrderNumber(input.message)
    const normalizedPhone = input.customerPhone?.replace(/\D/g, '') ?? ''
    const orders = orderNumber
      ? await this.findByOrderNumber(input.storeId, orderNumber)
      : await this.findByCustomerPhone(input.storeId, normalizedPhone)

    if (!orders.length) {
      return {
        reply: orderNumber
          ? `Nao encontrei o pedido ${formatOrderNumber(orderNumber)} no sistema. Pode conferir o numero do pedido ou informar o WhatsApp usado na compra?`
          : 'Para consultar o status com seguranca, preciso do numero do pedido ou do WhatsApp usado na compra.',
        intent: 'status_pedido',
        confidence: 0.9,
        shouldTransferToHuman: false,
        transferReason: null,
        sourcesUsed: ['orders'],
        recommendedAction: 'ask_more_info',
        orderDraft: null,
      }
    }

    if (!orderNumber && orders.length > 1) {
      return {
        reply: `Encontrei mais de um pedido recente nesse WhatsApp: ${orders
          .map((order) => order.number)
          .join(', ')}. Qual deles voce quer consultar?`,
        intent: 'status_pedido',
        confidence: 0.92,
        shouldTransferToHuman: false,
        transferReason: null,
        sourcesUsed: ['orders'],
        recommendedAction: 'ask_more_info',
        orderDraft: null,
      }
    }

    const order = orders[0]
    const complaint = this.hasComplaintSignal(input.message)
    return {
      reply: this.buildReply(order, complaint),
      intent: 'status_pedido',
      confidence: 0.96,
      shouldTransferToHuman: complaint || order.delayed,
      transferReason: complaint
        ? 'Cliente demonstrou insatisfacao durante consulta de status.'
        : order.delayed
          ? 'Pedido marcado como atrasado no Cain Delivery.'
          : null,
      sourcesUsed: ['orders', 'order_status_history', 'delivery_assignments', 'eta_snapshots'],
      recommendedAction: complaint || order.delayed ? 'request_human_help' : 'respond_automatically',
      orderDraft: null,
    }
  }

  private isOrderStatusIntent(message: string) {
    const normalized = normalizeText(message)
    return [
      'meu pedido',
      'status do pedido',
      'pedido saiu',
      'saiu para entrega',
      'cade meu pedido',
      'cadê meu pedido',
      'vai demorar',
      'ta demorando',
      'esta demorando',
      'em rota',
      'acompanhar pedido',
      'pedido atrasado',
    ].some((signal) => normalized.includes(normalizeText(signal)))
  }

  private hasComplaintSignal(message: string) {
    const normalized = normalizeText(message)
    return [
      'reclamar',
      'reclamacao',
      'reclamação',
      'absurdo',
      'atrasado',
      'demorando muito',
      'cancelar',
      'quero atendente',
    ].some((signal) => normalized.includes(normalizeText(signal)))
  }

  private extractOrderNumber(message: string) {
    const match = message.match(/#?\b\d{3,}\b/)
    return match?.[0].replace(/[^\d]/g, '') ?? null
  }

  private findByOrderNumber(storeId: string, orderNumber: string) {
    return this.prisma.order.findMany({
      where: {
        storeId,
        OR: [
          { number: orderNumber },
          { number: `#${orderNumber}` },
        ],
      },
      include: orderStatusInclude,
      orderBy: { createdAt: 'desc' },
      take: 2,
    })
  }

  private async findByCustomerPhone(storeId: string, customerPhone: string) {
    if (!customerPhone) {
      return []
    }

    const phoneSuffix = customerPhone.slice(-8)
    const phoneFilter =
      phoneSuffix.length >= 8
        ? {
            OR: [
              { customerPhone },
              { customerPhone: { endsWith: phoneSuffix } },
            ],
          }
        : { customerPhone }
    const openOrders = await this.prisma.order.findMany({
      where: {
        storeId,
        ...phoneFilter,
        status: {
          in: ['in_analysis', 'in_preparation', 'ready', 'out_for_delivery'],
        },
      },
      include: orderStatusInclude,
      orderBy: { createdAt: 'desc' },
      take: 3,
    })

    if (openOrders.length) {
      return openOrders
    }

    return this.prisma.order.findMany({
      where: {
        storeId,
        ...phoneFilter,
      },
      include: orderStatusInclude,
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
  }

  private buildReply(order: OrderStatusLookupOrder, shouldOfferHuman: boolean) {
    const lines = [
      `Pedido ${order.number}: ${statusLabel(order.status)}.`,
      `Criado em ${formatDateTime(order.createdAt)}.`,
    ]
    const items = order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')

    if (items) {
      lines.push(`Itens: ${items}.`)
    }

    if (order.status === 'out_for_delivery') {
      const driverName =
        order.driver?.name ?? order.deliveryAssignments[0]?.driver.name ?? null
      lines.push(driverName ? `Motoboy: ${driverName}.` : 'Motoboy: ainda nao informado.')
    }

    const eta = order.etaSnapshots[0]
    if (eta) {
      lines.push(`Previsao real mais recente: ${eta.etaMinutes} min.`)
    } else if (order.dueAt && !['completed', 'cancelled'].includes(order.status)) {
      lines.push(`Previsao operacional: ${formatDateTime(order.dueAt)}.`)
    }

    if (order.history[0]) {
      lines.push(`Ultima atualizacao: ${order.history[0].label} (${formatDateTime(order.history[0].createdAt)}).`)
    }

    if (shouldOfferHuman || order.delayed) {
      lines.push('Vou chamar um atendente humano para acompanhar isso de perto.')
    }

    return lines.join(' ')
  }
}

const orderStatusInclude = {
  driver: {
    select: {
      name: true,
    },
  },
  items: {
    select: {
      name: true,
      quantity: true,
    },
  },
  history: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 3,
    select: {
      status: true,
      label: true,
      createdAt: true,
    },
  },
  deliveryAssignments: {
    orderBy: {
      assignedAt: 'desc',
    },
    take: 1,
    select: {
      status: true,
      assignedAt: true,
      completedAt: true,
      driver: {
        select: {
          name: true,
        },
      },
    },
  },
  etaSnapshots: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    select: {
      etaMinutes: true,
      distanceMeters: true,
      message: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderInclude

function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    in_analysis: 'recebido e em analise',
    in_preparation: 'em preparo',
    ready: 'pronto',
    out_for_delivery: 'saiu para entrega',
    completed: 'concluido',
    cancelled: 'cancelado',
  }

  return labels[status]
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatOrderNumber(orderNumber: string) {
  return orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
