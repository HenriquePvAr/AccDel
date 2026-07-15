import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EvolutionApiWhatsappProvider } from '@/modules/ai-attendant/evolution-api-whatsapp.provider'

import type {
  MessagingProvider,
  ProviderSendRequest,
  ProviderSendResult,
} from '../../domain/messaging-provider'
import { MessagingProviderError } from '../../domain/messaging-provider'

@Injectable()
export class EvolutionLegacyMessagingProvider implements MessagingProvider {
  readonly providerName = 'evolution_legacy'

  constructor(private readonly config: ConfigService) {}

  async send(request: ProviderSendRequest): Promise<ProviderSendResult> {
    if (request.contentType !== 'TEXT') {
      throw new MessagingProviderError(
        'O bridge legado aceita somente mensagens de texto.',
        'legacy_unsupported_content_type',
        false,
      )
    }

    const sessionId = request.account.legacySessionId
    const body = request.payload.body
    if (!sessionId || typeof body !== 'string' || !body.trim()) {
      throw new MessagingProviderError('Conta legada ou payload invalido.', 'legacy_invalid_payload', false)
    }

    const provider = new EvolutionApiWhatsappProvider(
      this.config.get<string>('WHATSAPP_PROVIDER_BASE_URL'),
      this.config.get<string>('WHATSAPP_PROVIDER_API_KEY'),
    )
    const result = await provider.sendMessage(sessionId, request.recipient, body)
    if (result.status === 'failed' || !result.messageId) {
      throw new MessagingProviderError('Evolution API recusou o envio.', 'legacy_send_failed', true)
    }

    return { externalMessageId: result.messageId }
  }
}
