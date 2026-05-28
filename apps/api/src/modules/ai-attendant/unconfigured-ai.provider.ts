import { HttpException, HttpStatus } from '@nestjs/common'
import {
  AiProviderAdapter,
  AiReplyResult,
  AiClassificationResult,
  AiOrderDraftResult,
} from './ai-provider.adapter'

export class UnconfiguredAiProvider implements AiProviderAdapter {
  readonly providerName = 'unconfigured'

  async generateReply(): Promise<AiReplyResult> {
    throw new HttpException(
      'Provider de Inteligência Artificial não configurado (.env). Configure AI_PROVIDER, AI_PROVIDER_API_KEY e AI_PROVIDER_MODEL.',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  async classifyMessage(): Promise<AiClassificationResult> {
    // Default fallback classification without throwing to prevent breaking webhooks
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
