import type {
  AiClassificationResult,
  AiOrderDraftResult,
  AiProviderAdapter,
  AiReplyContext,
  AiReplyResult,
} from '../../ai-provider.adapter'
import { NvidiaAiGateway } from './nvidia-ai.gateway'

export class NvidiaAiProvider implements AiProviderAdapter {
  readonly providerName = 'nvidia'

  constructor(private readonly gateway: NvidiaAiGateway) {}

  async generateReply(context: AiReplyContext): Promise<AiReplyResult> {
    const result = await this.gateway.complete({
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            context.systemPrompt,
            `Loja: ${context.storeName}.`,
            context.settingsContext,
            context.knowledgeEntriesContext,
            'Este e um caminho legado sem ferramentas de catalogo.',
            'Nao informe produtos, precos ou promocoes. Encaminhe esses pedidos para um humano.',
            'Responda apenas JSON: {"reply":string,"intent":string,"confidence":number,"shouldTransferToHuman":boolean,"transferReason":string|null,"recommendedAction":"respond_automatically"|"request_human_help"|"ask_more_info"}.',
          ].join('\n'),
        },
        ...context.conversationHistory.slice(-10).map((message) => ({
          role: message.direction === 'inbound' || message.role === 'customer' ? 'user' as const : 'assistant' as const,
          content: message.content,
        })),
        { role: 'user', content: context.message },
      ],
    })
    return parseReply(result.message.content)
  }

  async classifyMessage(): Promise<AiClassificationResult> {
    return { intent: 'other', confidence: 1 }
  }

  async extractOrderDraft(): Promise<AiOrderDraftResult> {
    return { parsedItems: [], missingFields: [] }
  }
}

function parseReply(content: string | null): AiReplyResult {
  let value: unknown
  try {
    value = JSON.parse(content ?? '')
  } catch {
    value = null
  }
  const record = isRecord(value) ? value : {}
  const action =
    record.recommendedAction === 'request_human_help' || record.recommendedAction === 'ask_more_info'
      ? record.recommendedAction
      : 'respond_automatically'

  return {
    reply:
      typeof record.reply === 'string' && record.reply.trim()
        ? record.reply.trim()
        : 'Vou chamar uma pessoa da equipe para continuar seu atendimento.',
    intent: typeof record.intent === 'string' ? record.intent : 'other',
    confidence: typeof record.confidence === 'number' ? Math.max(0, Math.min(1, record.confidence)) : 0,
    shouldTransferToHuman: record.shouldTransferToHuman !== false,
    transferReason:
      typeof record.transferReason === 'string' ? record.transferReason : 'legacy_without_tools',
    sourcesUsed: [],
    recommendedAction: action,
    orderDraft: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
