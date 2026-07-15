import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { MessagingOutboxService } from '@/modules/messaging/application/messaging-outbox.service'
import { runWithStoreContext } from '@/shared/store-context'

import { NvidiaAiGateway } from './providers/nvidia/nvidia-ai.gateway'
import type { NvidiaChatMessage } from './providers/nvidia/nvidia-ai.types'
import {
  buildWhatsappAttendantPrompt,
  WHATSAPP_ATTENDANT_PROMPT_VERSION,
} from './prompts/whatsapp-attendant.prompt'
import { AiConversationRepository } from './tools/ai-conversation.repository'
import { AiToolRegistry } from './tools/ai-tool.registry'

@Injectable()
export class CloudAiConversationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudAiConversationProcessor.name)
  private interval?: NodeJS.Timeout
  private running = false

  constructor(
    private readonly config: ConfigService,
    private readonly conversations: AiConversationRepository,
    private readonly gateway: NvidiaAiGateway,
    private readonly tools: AiToolRegistry,
    private readonly outbox: MessagingOutboxService,
  ) {}

  onModuleInit() {
    const whatsappProvider = this.config.get<string>('WHATSAPP_PROVIDER')?.trim()
    if (!['cloud', 'whatsapp_cloud'].includes(whatsappProvider ?? '') || this.config.get<string>('AI_PROVIDER')?.trim() !== 'nvidia') {
      return
    }
    this.interval = setInterval(() => void this.tick(), 750)
    this.interval.unref()
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval)
  }

  async tick() {
    if (this.running) return
    this.running = true
    try {
      for (let index = 0; index < 5; index += 1) {
        const pending = await this.conversations.findPendingInboundEvent()
        if (!pending || !(await this.conversations.claimInboundEvent(pending.id))) break
        await this.process(pending.id)
      }
    } finally {
      this.running = false
    }
  }

  private async process(eventId: string) {
    const event = await this.conversations.getInboundEvent(eventId)
    const conversation = event?.conversation
    if (!event || !conversation || !conversation.messagingAccount) {
      await this.conversations.markInboundFailed(eventId, 'invalid_conversation')
      return
    }

    await runWithStoreContext(
      { storeId: event.storeId, source: 'webhook' },
      async () => this.processInStoreContext(event, conversation),
    )
  }

  private async processInStoreContext(
    event: NonNullable<Awaited<ReturnType<AiConversationRepository['getInboundEvent']>>>,
    conversation: NonNullable<Awaited<ReturnType<AiConversationRepository['getInboundEvent']>>>['conversation'] & {},
  ) {
    if (!conversation || !conversation.messagingAccount) return
    if (['WAITING_HUMAN', 'HUMAN_ACTIVE', 'PAUSED', 'CLOSED'].includes(conversation.operationalStatus)) {
      await this.conversations.markInboundProcessed(event.id)
      return
    }

    const [store, promptContext, history] = await Promise.all([
      this.conversations.getStoreSnapshot(event.storeId),
      this.conversations.getPromptContext(event.storeId),
      this.conversations.getHistory(conversation.id),
    ])
    if (!store.whatsappAiEnabled || !promptContext.enabled) {
      await this.conversations.markInboundProcessed(event.id)
      return
    }

    const normalized = asRecord(event.normalizedPayload)
    const inboundText = typeof normalized.body === 'string' ? normalized.body : ''
    const externalMessageId = typeof normalized.externalEventId === 'string'
      ? normalized.externalEventId
      : event.externalEventId
    const model = this.config.get<string>('NVIDIA_MODEL')?.trim() ?? 'unconfigured'
    const startedAt = Date.now()
    const execution = await this.conversations.createExecution({
      storeId: event.storeId,
      conversationId: conversation.id,
      inboundEventId: event.id,
      correlationId: event.correlationId,
      model,
      promptVersion: WHATSAPP_ATTENDANT_PROMPT_VERSION,
    })
    let toolCallCount = 0

    try {
      const messages: NvidiaChatMessage[] = [
        {
          role: 'system',
          content: buildWhatsappAttendantPrompt({
            storeName: store.tradeName,
            assistantName: promptContext.assistantName,
            customerName: conversation.customerName,
            tone: promptContext.tone,
            useEmojis: promptContext.useEmojis,
            mainPrompt: promptContext.mainPrompt,
            knowledge: promptContext.knowledge,
          }),
        },
        ...history,
      ]
      let reply = ''

      for (let round = 0; round < 6; round += 1) {
        const completion = await this.gateway.complete({
          messages,
          tools: this.tools.definitions(),
          toolChoice: 'auto',
          temperature: 0.1,
        })
        const calls = completion.message.tool_calls ?? []
        if (!calls.length) {
          reply = completion.message.content?.trim() ?? ''
          break
        }

        messages.push(completion.message)
        for (const call of calls.slice(0, 4)) {
          if (toolCallCount >= 12) break
          toolCallCount += 1
          const result = await this.tools.execute({
            executionId: execution.id,
            name: call.function.name,
            rawArguments: call.function.arguments,
            context: {
              storeId: event.storeId,
              conversationId: conversation.id,
              accountId: conversation.messagingAccount.id,
              customerId: conversation.customerId,
              inboundEventId: event.id,
              inboundExternalId: externalMessageId,
              explicitlyConfirmed: isExplicitOrderConfirmation(inboundText),
            },
          })
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: limitToolResult(result),
          })
        }
      }

      if (!reply || reply.length > 4_096) {
        throw new Error('invalid_ai_reply')
      }
      const latestOperationalStatus = await this.conversations.getOperationalStatus(conversation.id)
      if (['HUMAN_ACTIVE', 'PAUSED', 'CLOSED'].includes(latestOperationalStatus)) {
        await this.conversations.markInboundProcessed(event.id)
        await this.conversations.completeExecution(execution.id, {
          status: 'SUCCEEDED',
          latencyMs: Date.now() - startedAt,
          toolCallCount,
        })
        return
      }
      await this.outbox.enqueueText({
        storeId: event.storeId,
        accountId: conversation.messagingAccount.id,
        conversationId: conversation.id,
        recipient: conversation.whatsappNumber,
        body: reply,
        idempotencyKey: `ai-reply:${externalMessageId}`,
        replyToExternalId: externalMessageId,
        senderType: 'ai',
      })
      await this.conversations.markAiResponded(conversation.id, WHATSAPP_ATTENDANT_PROMPT_VERSION)
      await this.conversations.markInboundProcessed(event.id)
      await this.conversations.completeExecution(execution.id, {
        status: 'SUCCEEDED',
        latencyMs: Date.now() - startedAt,
        toolCallCount,
      })
    } catch (error) {
      await this.handleFallback(event, conversation, externalMessageId)
      await this.conversations.completeExecution(execution.id, {
        status: 'FALLBACK',
        latencyMs: Date.now() - startedAt,
        toolCallCount,
        errorCode: safeErrorCode(error),
      })
      await this.conversations.markInboundProcessed(event.id)
      this.logger.warn(`Execucao ${execution.id} terminou em fallback.`)
    }
  }

  private async handleFallback(
    event: NonNullable<Awaited<ReturnType<AiConversationRepository['getInboundEvent']>>>,
    conversation: NonNullable<NonNullable<Awaited<ReturnType<AiConversationRepository['getInboundEvent']>>>['conversation']>,
    externalMessageId: string,
  ) {
    await this.conversations.requestHandoff(conversation.id, 'ai_provider_fallback')
    if (!conversation.messagingAccount) return
    await this.outbox.enqueueText({
      storeId: event.storeId,
      accountId: conversation.messagingAccount.id,
      conversationId: conversation.id,
      recipient: conversation.whatsappNumber,
      body: 'Tive uma dificuldade agora e vou chamar uma pessoa da equipe para continuar seu atendimento.',
      idempotencyKey: `ai-fallback:${externalMessageId}`,
      replyToExternalId: externalMessageId,
      senderType: 'system',
    })
  }
}

export function isExplicitOrderConfirmation(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return /^(confirmar|confirmo|pode fechar|pode fazer o pedido|sim,? (esta correto|pode fazer|pode fechar))[.! ]*$/.test(normalized)
}

function limitToolResult(value: unknown) {
  const serialized = JSON.stringify(value)
  return serialized.length <= 8_000 ? serialized : JSON.stringify({ ok: false, code: 'tool_result_too_large' })
}

function safeErrorCode(error: unknown) {
  if (!(error instanceof Error)) return 'unknown_error'
  return error.message.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown_error'
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
