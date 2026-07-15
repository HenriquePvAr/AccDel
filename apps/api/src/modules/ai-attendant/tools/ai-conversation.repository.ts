import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'

import { PrismaService } from '@/shared/prisma/prisma.service'

import type { DraftItem, DraftMetadata } from './ai-tool.types'

@Injectable()
export class AiConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  getInboundEvent(eventId: string) {
    return this.prisma.inboundEvent.findUnique({
      where: { id: eventId },
      include: {
        conversation: {
          include: { messagingAccount: true, customer: true },
        },
      },
    })
  }

  findPendingInboundEvent() {
    return this.prisma.inboundEvent.findFirst({
      where: { status: 'RECEIVED', eventType: 'message', conversationId: { not: null } },
      orderBy: { receivedAt: 'asc' },
      select: { id: true },
    })
  }

  async claimInboundEvent(eventId: string) {
    const claimed = await this.prisma.inboundEvent.updateMany({
      where: { id: eventId, status: 'RECEIVED' },
      data: { status: 'PROCESSING' },
    })
    return claimed.count === 1
  }

  markInboundProcessed(eventId: string) {
    return this.prisma.inboundEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date(), errorCode: null },
    })
  }

  markInboundFailed(eventId: string, code: string) {
    return this.prisma.inboundEvent.update({
      where: { id: eventId },
      data: { status: 'FAILED', failedAt: new Date(), errorCode: code.slice(0, 80) },
    })
  }

  async getHistory(conversationId: string) {
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 16,
      select: { direction: true, body: true },
    })
    return messages.reverse().map((message) => ({
      role: message.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: message.body,
    }))
  }

  getStoreSnapshot(storeId: string) {
    return this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        tradeName: true,
        timezone: true,
        businessHours: true,
        businessDays: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        whatsappAiEnabled: true,
        minimumOrderAmount: true,
        estimatedPrepTimeMinutes: true,
        estimatedDeliveryTimeMinutes: true,
      },
    })
  }

  async getPromptContext(storeId: string) {
    const [settings, knowledge] = await Promise.all([
      this.prisma.aiAttendantSettings.findUnique({ where: { storeId } }),
      this.prisma.aiKnowledgeEntry.findMany({
        where: { storeId, isActive: true, channels: { has: 'whatsapp' } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 8,
        select: { type: true, title: true, content: true },
      }),
    ])
    return {
      enabled: Boolean(settings?.isEnabled && settings.mode !== 'off'),
      assistantName: settings?.assistantName ?? 'Atendente Cain',
      tone: settings?.tone ?? 'friendly',
      useEmojis: settings?.useEmojis ?? true,
      mainPrompt: settings?.mainPrompt ?? '',
      knowledge: knowledge.map((entry) => ({
        type: entry.type,
        title: entry.title.slice(0, 120),
        content: entry.content.slice(0, 800),
      })),
    }
  }

  markAiResponded(conversationId: string, promptVersion: string) {
    return this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        lastAiResponseAt: new Date(),
        promptVersion,
        lastStatus: 'ai_reply_queued',
      },
    })
  }

  async getOperationalStatus(conversationId: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { operationalStatus: true },
    })
    return conversation?.operationalStatus ?? 'CLOSED'
  }

  getActiveDraft(conversationId: string) {
    return this.prisma.aiOrderDraft.findFirst({
      where: { conversationId, status: { in: ['suggested', 'approved'] } },
      orderBy: { updatedAt: 'desc' },
    })
  }

  getLatestDraft(conversationId: string) {
    return this.prisma.aiOrderDraft.findFirst({
      where: { conversationId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createDraft(
    conversationId: string,
    customerId: string | null,
    serviceType: DraftMetadata['serviceType'],
  ) {
    const active = await this.getActiveDraft(conversationId)
    if (active) return active

    return this.prisma.aiOrderDraft.create({
      data: {
        conversationId,
        customerId,
        rawText: 'Rascunho controlado por ferramentas',
        parsedItems: [],
        missingFields: serviceType === 'delivery'
          ? ['items', 'address', 'payment_method']
          : ['items', 'payment_method'],
        metadata: { serviceType },
      },
    })
  }

  async updateDraft(
    draftId: string,
    version: number,
    input: { items: DraftItem[]; metadata: DraftMetadata; missingFields: string[] },
  ) {
    const changed = await this.prisma.aiOrderDraft.updateMany({
      where: { id: draftId, version, status: { in: ['suggested', 'approved'] } },
      data: {
        parsedItems: input.items as unknown as Prisma.InputJsonValue,
        metadata: input.metadata as unknown as Prisma.InputJsonValue,
        missingFields: input.missingFields,
        version: { increment: 1 },
      },
    })
    if (changed.count !== 1) {
      throw new ConflictException('O rascunho foi alterado por outro processamento.')
    }
    return this.prisma.aiOrderDraft.findUniqueOrThrow({ where: { id: draftId } })
  }

  async markDraftConverted(
    draftId: string,
    orderId: string,
    confirmationMessageId: string,
  ) {
    return this.prisma.aiOrderDraft.update({
      where: { id: draftId },
      data: {
        status: 'converted',
        convertedOrderId: orderId,
        confirmedAt: new Date(),
        confirmationMessageId,
      },
    })
  }

  async requestHandoff(conversationId: string, reason: string) {
    return this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        operationalStatus: 'WAITING_HUMAN',
        status: 'waiting_human',
        isAiPaused: true,
        lastStatus: `handoff:${reason.slice(0, 80)}`,
      },
      select: { id: true, operationalStatus: true },
    })
  }

  async getCustomerOrder(storeId: string, customerId: string | null, orderId?: string) {
    if (!customerId) throw new NotFoundException('Cliente nao identificado.')
    const order = await this.prisma.order.findFirst({
      where: {
        storeId,
        customerId,
        ...(orderId ? { id: orderId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, status: true, serviceType: true, total: true, dueAt: true },
    })
    if (!order) throw new NotFoundException('Pedido nao encontrado para este cliente.')
    return { ...order, total: Number(order.total), dueAt: order.dueAt.toISOString() }
  }

  createExecution(input: {
    storeId: string
    conversationId: string
    inboundEventId: string
    correlationId: string
    model: string
    promptVersion: string
  }) {
    return this.prisma.aiExecution.create({
      data: {
        ...input,
        provider: 'nvidia',
      },
    })
  }

  createToolCall(executionId: string, name: string, rawArguments: string) {
    return this.prisma.aiToolCall.create({
      data: {
        executionId,
        name,
        argumentsHash: createHash('sha256').update(rawArguments).digest('hex'),
      },
    })
  }

  completeToolCall(id: string, status: 'SUCCEEDED' | 'REJECTED' | 'FAILED', resultCode: string, latencyMs: number) {
    return this.prisma.aiToolCall.update({
      where: { id },
      data: { status, resultCode: resultCode.slice(0, 80), latencyMs, completedAt: new Date() },
    })
  }

  completeExecution(
    id: string,
    input: { status: 'SUCCEEDED' | 'FAILED' | 'FALLBACK'; latencyMs: number; toolCallCount: number; errorCode?: string },
  ) {
    return this.prisma.aiExecution.update({
      where: { id },
      data: { ...input, completedAt: new Date() },
    })
  }
}

export function parseDraftItems(value: Prisma.JsonValue): DraftItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.productId !== 'string') return []
    const quantity = typeof item.quantity === 'number' ? Math.max(1, Math.floor(item.quantity)) : 1
    const options = Array.isArray(item.options)
      ? item.options.flatMap((option) => {
          if (!isRecord(option) || typeof option.groupId !== 'string' || typeof option.optionId !== 'string') return []
          return [{
            groupId: option.groupId,
            optionId: option.optionId,
            quantity: typeof option.quantity === 'number' ? Math.max(1, Math.floor(option.quantity)) : 1,
          }]
        })
      : []
    return [{
      productId: item.productId,
      quantity,
      ...(typeof item.notes === 'string' ? { notes: item.notes } : {}),
      options,
    }]
  })
}

export function parseDraftMetadata(value: Prisma.JsonValue): DraftMetadata {
  const record = isRecord(value) ? value : {}
  const serviceType = record.serviceType === 'pickup' ? 'pickup' : 'delivery'
  const paymentMethods = ['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'payment_link']
  return {
    serviceType,
    ...(typeof record.addressId === 'string' ? { addressId: record.addressId } : {}),
    ...(typeof record.paymentMethod === 'string' && paymentMethods.includes(record.paymentMethod)
      ? { paymentMethod: record.paymentMethod as DraftMetadata['paymentMethod'] }
      : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
