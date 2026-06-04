import { HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'

import {
  AiClassificationResult,
  AiOrderDraftResult,
  AiOrderDraftSuggestion,
  AiProviderAdapter,
  AiReplyContext,
  AiReplyResult,
} from './ai-provider.adapter'

type LovableHistoryRole = 'user' | 'assistant'

interface LovableBotReplyPayload {
  conversationId: string
  storeId: string
  customer: {
    name: string | null
    phone: string | null
  }
  message: string
  history: {
    role: LovableHistoryRole
    content: string
  }[]
  context: {
    channel: AiReplyContext['channel']
    orderMode: AiReplyContext['orderMode']
  }
  timestamp: string
}

interface LovableBotReplySuccess {
  ok: true
  reply: string
  intent: string
  confidence: number
  shouldTransferToHuman: boolean
  sourcesUsed: string[]
  orderDraft: AiOrderDraftSuggestion | null
}

interface LovableBotReplyFailure {
  ok: false
  error: string
}

type LovableBotReplyResponse = LovableBotReplySuccess | LovableBotReplyFailure

export class LovableBackendAiProvider implements AiProviderAdapter {
  readonly providerName = 'lovable_backend'

  constructor(private readonly configService: ConfigService) {}

  async generateReply(context: AiReplyContext): Promise<AiReplyResult> {
    const url = this.readEnv('LOVABLE_BOT_REPLY_URL')
    const secret = this.readEnv('LOVABLE_BOT_REPLY_SECRET')

    if (!url || !secret) {
      throw new HttpException(
        'Provider de IA nao configurado. Configure LOVABLE_BOT_REPLY_URL e LOVABLE_BOT_REPLY_SECRET.',
        HttpStatus.NOT_IMPLEMENTED,
      )
    }

    const payload = this.buildPayload(context)
    const body = JSON.stringify(payload)
    const signature = createHmac('sha256', secret).update(body).digest('hex')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.readTimeoutMs())

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cain-timestamp': payload.timestamp,
          'x-cain-signature': signature,
          'x-cain-store-id': payload.storeId,
        },
        body,
        signal: controller.signal,
      })

      const responseBody = await response.text()

      if (!response.ok) {
        throw new HttpException(
          `Lovable backend retornou HTTP ${response.status}.`,
          HttpStatus.BAD_GATEWAY,
        )
      }

      const parsed = this.parseResponse(responseBody)

      if (!parsed.ok) {
        throw new HttpException(
          `Lovable backend recusou a solicitacao: ${parsed.error}`,
          HttpStatus.BAD_GATEWAY,
        )
      }

      return {
        reply: parsed.reply,
        intent: parsed.intent,
        confidence: parsed.confidence,
        shouldTransferToHuman: parsed.shouldTransferToHuman,
        transferReason: parsed.shouldTransferToHuman
          ? 'Lovable backend solicitou transferencia para humano.'
          : null,
        sourcesUsed: parsed.sourcesUsed,
        recommendedAction: this.resolveRecommendedAction(parsed),
        orderDraft: parsed.orderDraft,
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error
      }

      const message = error instanceof Error ? error.message : 'Erro desconhecido.'
      throw new HttpException(
        `Falha ao chamar Lovable backend: ${message}`,
        HttpStatus.BAD_GATEWAY,
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async classifyMessage(): Promise<AiClassificationResult> {
    return {
      intent: 'other',
      confidence: 1,
    }
  }

  async extractOrderDraft(): Promise<AiOrderDraftResult> {
    return {
      parsedItems: [],
      missingFields: [],
    }
  }

  private buildPayload(context: AiReplyContext): LovableBotReplyPayload {
    return {
      conversationId: context.conversationId,
      storeId: context.storeId,
      customer: {
        name: context.customer.name,
        phone: context.customer.phone,
      },
      message: context.message,
      history: context.conversationHistory
        .slice(-20)
        .map((message) => this.mapHistoryMessage(message))
        .filter((message): message is { role: LovableHistoryRole; content: string } => message !== null),
      context: {
        channel: context.channel,
        orderMode: context.orderMode,
      },
      timestamp: new Date().toISOString(),
    }
  }

  private mapHistoryMessage(message: AiReplyContext['conversationHistory'][number]) {
    const content = message.content.trim()

    if (!content) {
      return null
    }

    if (message.role === 'customer' || message.direction === 'inbound') {
      return {
        role: 'user' as const,
        content,
      }
    }

    if (message.role === 'ai' || message.role === 'human' || message.direction === 'outbound') {
      return {
        role: 'assistant' as const,
        content,
      }
    }

    return null
  }

  private parseResponse(responseBody: string): LovableBotReplyResponse {
    let parsed: unknown

    try {
      parsed = JSON.parse(responseBody)
    } catch {
      throw new HttpException(
        'Lovable backend retornou JSON invalido.',
        HttpStatus.BAD_GATEWAY,
      )
    }

    if (!isRecord(parsed)) {
      throw new HttpException(
        'Lovable backend retornou um payload inesperado.',
        HttpStatus.BAD_GATEWAY,
      )
    }

    if (parsed.ok === false) {
      return {
        ok: false,
        error: typeof parsed.error === 'string' ? parsed.error : 'Erro nao informado.',
      }
    }

    if (parsed.ok !== true || typeof parsed.reply !== 'string') {
      throw new HttpException(
        'Lovable backend nao retornou uma resposta de IA valida.',
        HttpStatus.BAD_GATEWAY,
      )
    }

    return {
      ok: true,
      reply: parsed.reply,
      intent: typeof parsed.intent === 'string' ? parsed.intent : 'other',
      confidence: normalizeConfidence(parsed.confidence),
      shouldTransferToHuman: parsed.shouldTransferToHuman === true,
      sourcesUsed: normalizeStringArray(parsed.sourcesUsed),
      orderDraft: normalizeOrderDraft(parsed.orderDraft),
    }
  }

  private resolveRecommendedAction(response: LovableBotReplySuccess) {
    if (response.shouldTransferToHuman) {
      return 'request_human_help' as const
    }

    if (response.confidence < 0.6) {
      return 'request_human_help' as const
    }

    return 'respond_automatically' as const
  }

  private readEnv(name: string): string | null {
    const value = this.configService.get<string>(name)
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }

  private readTimeoutMs(): number {
    const rawValue = this.configService.get<string>('LOVABLE_BOT_REPLY_TIMEOUT_MS')
    const parsed = rawValue ? Number.parseInt(rawValue, 10) : 20000
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20000
  }
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.5
  }

  return Math.min(1, Math.max(0, value))
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeOrderDraft(value: unknown): AiOrderDraftSuggestion | null {
  if (!isRecord(value)) {
    return null
  }

  const parsedItems = Array.isArray(value.parsedItems)
    ? value.parsedItems
        .map(normalizeOrderDraftItem)
        .filter((item): item is AiOrderDraftSuggestion['parsedItems'][number] => item !== null)
    : []
  const missingFields = normalizeStringArray(value.missingFields)
  const rawText = typeof value.rawText === 'string' && value.rawText.trim() ? value.rawText : undefined

  return {
    ...(rawText ? { rawText } : {}),
    parsedItems,
    missingFields,
  }
}

function normalizeOrderDraftItem(value: unknown): AiOrderDraftSuggestion['parsedItems'][number] | null {
  if (!isRecord(value) || typeof value.productName !== 'string') {
    return null
  }

  const quantity = typeof value.quantity === 'number' && Number.isFinite(value.quantity)
    ? value.quantity
    : 1
  const notes = typeof value.notes === 'string' && value.notes.trim() ? value.notes : undefined
  const productId = typeof value.productId === 'string' && value.productId.trim() ? value.productId : undefined
  const options = Array.isArray(value.options)
    ? value.options
        .map(normalizeOrderDraftOption)
        .filter((option): option is NonNullable<AiOrderDraftSuggestion['parsedItems'][number]['options']>[number] => option !== null)
    : undefined
  const addons = Array.isArray(value.addons)
    ? value.addons
        .map(normalizeOrderDraftAddon)
        .filter((addon): addon is NonNullable<AiOrderDraftSuggestion['parsedItems'][number]['addons']>[number] => addon !== null)
    : undefined
  const price = typeof value.price === 'number' && Number.isFinite(value.price)
    ? value.price
    : undefined

  return {
    ...(productId ? { productId } : {}),
    productName: value.productName,
    quantity,
    ...(options && options.length ? { options } : {}),
    ...(addons && addons.length ? { addons } : {}),
    ...(notes ? { notes } : {}),
    ...(price !== undefined ? { price } : {}),
  }
}

function normalizeOrderDraftOption(
  value: unknown,
): NonNullable<AiOrderDraftSuggestion['parsedItems'][number]['options']>[number] | null {
  if (!isRecord(value)) {
    return null
  }

  const groupId = typeof value.groupId === 'string' && value.groupId.trim() ? value.groupId : undefined
  const groupName = typeof value.groupName === 'string' && value.groupName.trim() ? value.groupName : undefined
  const optionId = typeof value.optionId === 'string' && value.optionId.trim() ? value.optionId : undefined
  const optionName = typeof value.optionName === 'string' && value.optionName.trim() ? value.optionName : undefined

  if (!groupId && !groupName && !optionId && !optionName) {
    return null
  }

  const quantity =
    typeof value.quantity === 'number' && Number.isFinite(value.quantity)
      ? Math.max(1, value.quantity)
      : undefined
  const price =
    typeof value.price === 'number' && Number.isFinite(value.price) ? value.price : undefined

  return {
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName } : {}),
    ...(optionId ? { optionId } : {}),
    ...(optionName ? { optionName } : {}),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(price !== undefined ? { price } : {}),
  }
}

function normalizeOrderDraftAddon(
  value: unknown,
): NonNullable<AiOrderDraftSuggestion['parsedItems'][number]['addons']>[number] | null {
  if (!isRecord(value) || typeof value.productName !== 'string') {
    return null
  }

  const productId = typeof value.productId === 'string' && value.productId.trim() ? value.productId : undefined
  const quantity =
    typeof value.quantity === 'number' && Number.isFinite(value.quantity)
      ? Math.max(1, value.quantity)
      : 1
  const notes = typeof value.notes === 'string' && value.notes.trim() ? value.notes : undefined
  const price = typeof value.price === 'number' && Number.isFinite(value.price) ? value.price : undefined

  return {
    ...(productId ? { productId } : {}),
    productName: value.productName,
    quantity,
    ...(notes ? { notes } : {}),
    ...(price !== undefined ? { price } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
