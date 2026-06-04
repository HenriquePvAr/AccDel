import { HttpException, HttpStatus } from '@nestjs/common'
import {
  AiClassificationResult,
  AiOrderDraftResult,
  AiProviderAdapter,
  AiReplyResult,
} from './ai-provider.adapter'

export class UnconfiguredAiProvider implements AiProviderAdapter {
  readonly providerName = 'unconfigured'

  constructor(
    private readonly message = 'Provider de Inteligencia Artificial nao configurado (.env). Configure AI_PROVIDER e as variaveis do provider escolhido.',
  ) {}

  async generateReply(): Promise<AiReplyResult> {
    throw new HttpException(this.message, HttpStatus.NOT_IMPLEMENTED)
  }

  async classifyMessage(): Promise<AiClassificationResult> {
    return {
      intent: 'other',
      confidence: 1.0,
    }
  }

  async extractOrderDraft(): Promise<AiOrderDraftResult> {
    return {
      parsedItems: [],
      missingFields: [],
    }
  }
}
