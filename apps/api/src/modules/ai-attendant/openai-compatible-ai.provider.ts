import { HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  AiClassificationResult,
  AiOrderDraftResult,
  AiOrderDraftSuggestion,
  AiProviderAdapter,
  AiReplyContext,
  AiReplyResult,
} from './ai-provider.adapter'

type OpenAiMessageRole = 'system' | 'user' | 'assistant'

interface OpenAiCompatibleProviderOptions {
  providerName: 'openai' | 'groq' | 'openrouter'
  defaultBaseUrl: string
}

interface OpenAiChatCompletionPayload {
  model: string
  messages: {
    role: OpenAiMessageRole
    content: string
  }[]
  temperature: number
  response_format: {
    type: 'json_object'
  }
}

export class OpenAiCompatibleAiProvider implements AiProviderAdapter {
  readonly providerName: string

  constructor(
    private readonly configService: ConfigService,
    private readonly options: OpenAiCompatibleProviderOptions,
  ) {
    this.providerName = options.providerName
  }

  async generateReply(context: AiReplyContext): Promise<AiReplyResult> {
    const apiKey = this.readEnv('AI_PROVIDER_API_KEY')
    const model = this.readEnv('AI_PROVIDER_MODEL')

    if (!apiKey || !model) {
      throw new HttpException(
        'Provider de IA nao configurado. Configure AI_PROVIDER_API_KEY e AI_PROVIDER_MODEL no ambiente da API.',
        HttpStatus.NOT_IMPLEMENTED,
      )
    }

    const body = JSON.stringify(this.buildPayload(context, model))
    const response = await fetch(this.resolveChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })
    const responseText = await response.text()

    if (!response.ok) {
      throw new HttpException(
        `${this.providerName} retornou HTTP ${response.status}.`,
        HttpStatus.BAD_GATEWAY,
      )
    }

    const content = this.extractMessageContent(responseText)
    return this.parseStructuredReply(content)
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

  private buildPayload(context: AiReplyContext, model: string): OpenAiChatCompletionPayload {
    return {
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(context),
        },
        ...context.conversationHistory.slice(-12).map((message) => ({
          role: this.mapHistoryRole(message),
          content: message.content,
        })),
        {
          role: 'user',
          content: context.message,
        },
      ],
    }
  }

  private buildSystemPrompt(context: AiReplyContext): string {
    return [
      context.systemPrompt,
      'Responda somente em JSON valido, sem markdown.',
      'Schema obrigatorio: {"reply":string,"intent":string,"confidence":number,"shouldTransferToHuman":boolean,"transferReason":string|null,"sourcesUsed":string[],"recommendedAction":"respond_automatically"|"request_human_help"|"ask_more_info","orderDraft":null|{"rawText"?:string,"parsedItems":{"productId"?:string,"productName":string,"quantity":number,"options"?:{"groupId"?:string,"groupName"?:string,"optionId"?:string,"optionName"?:string,"quantity"?:number,"price"?:number}[],"addons"?:{"productId"?:string,"productName":string,"quantity":number,"notes"?:string,"price"?:number}[],"notes"?:string,"price"?:number}[],"missingFields":string[]}}',
      'Nao inclua texto fora do JSON.',
    ].join('\n')
  }

  private mapHistoryRole(message: AiReplyContext['conversationHistory'][number]): OpenAiMessageRole {
    if (message.role === 'customer' || message.direction === 'inbound') {
      return 'user'
    }

    return 'assistant'
  }

  private extractMessageContent(responseText: string): string {
    const parsed = parseJsonRecord(responseText)
    const choices = parsed.choices

    if (!Array.isArray(choices)) {
      throw new HttpException(
        `${this.providerName} retornou payload sem choices.`,
        HttpStatus.BAD_GATEWAY,
      )
    }

    const firstChoice = choices[0]

    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
      throw new HttpException(
        `${this.providerName} retornou payload sem message.`,
        HttpStatus.BAD_GATEWAY,
      )
    }

    const content = firstChoice.message.content

    if (typeof content !== 'string' || !content.trim()) {
      throw new HttpException(
        `${this.providerName} retornou resposta vazia.`,
        HttpStatus.BAD_GATEWAY,
      )
    }

    return content
  }

  private parseStructuredReply(content: string): AiReplyResult {
    const parsed = parseJsonRecord(stripJsonFence(content))

    if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      throw new HttpException(
        `${this.providerName} nao retornou reply valido.`,
        HttpStatus.BAD_GATEWAY,
      )
    }

    return {
      reply: parsed.reply,
      intent: typeof parsed.intent === 'string' ? parsed.intent : 'other',
      confidence: normalizeConfidence(parsed.confidence),
      shouldTransferToHuman: parsed.shouldTransferToHuman === true,
      transferReason: normalizeNullableString(parsed.transferReason),
      sourcesUsed: normalizeStringArray(parsed.sourcesUsed),
      recommendedAction: normalizeRecommendedAction(parsed.recommendedAction),
      orderDraft: normalizeOrderDraft(parsed.orderDraft),
    }
  }

  private resolveChatCompletionsUrl(): string {
    const baseUrl = this.readEnv('AI_PROVIDER_BASE_URL') ?? this.options.defaultBaseUrl
    return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  }

  private readEnv(name: string): string | null {
    const value = this.configService.get<string>(name)
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }
}

function parseJsonRecord(value: string): Record<string, unknown> {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new HttpException('Provider de IA retornou JSON invalido.', HttpStatus.BAD_GATEWAY)
  }

  if (!isRecord(parsed)) {
    throw new HttpException('Provider de IA retornou payload inesperado.', HttpStatus.BAD_GATEWAY)
  }

  return parsed
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.5
  }

  return Math.min(1, Math.max(0, value))
}

function normalizeRecommendedAction(value: unknown): AiReplyResult['recommendedAction'] {
  if (
    value === 'respond_automatically' ||
    value === 'request_human_help' ||
    value === 'ask_more_info'
  ) {
    return value
  }

  return 'respond_automatically'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
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
