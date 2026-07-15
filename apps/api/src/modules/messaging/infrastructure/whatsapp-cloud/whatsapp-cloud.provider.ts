import { Injectable } from '@nestjs/common'

import type {
  MessagingProvider,
  ProviderSendRequest,
  ProviderSendResult,
} from '../../domain/messaging-provider'
import { MessagingProviderError } from '../../domain/messaging-provider'
import { WhatsappCloudConfig } from './whatsapp-cloud.config'

@Injectable()
export class WhatsappCloudProvider implements MessagingProvider {
  readonly providerName = 'whatsapp_cloud'

  constructor(private readonly config: WhatsappCloudConfig) {}

  async send(request: ProviderSendRequest): Promise<ProviderSendResult> {
    if (request.account.phoneNumberId !== this.config.phoneNumberId) {
      throw new MessagingProviderError('Conta de mensageria divergente da configuracao.', 'account_mismatch', false)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await fetch(this.messagesUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildPayload(request)),
        signal: controller.signal,
      })
      const responseBody = await readJson(response)

      if (!response.ok) {
        const error = isRecord(responseBody.error) ? responseBody.error : {}
        const code = String(error.code ?? `http_${response.status}`)
        throw new MessagingProviderError(
          `WhatsApp Cloud API recusou o envio (HTTP ${response.status}).`,
          code,
          isRetryableStatus(response.status),
        )
      }

      const messages = Array.isArray(responseBody.messages) ? responseBody.messages : []
      const first = isRecord(messages[0]) ? messages[0] : {}
      const messageId = typeof first.id === 'string' ? first.id : null
      if (!messageId) {
        throw new MessagingProviderError('WhatsApp Cloud API respondeu sem message id.', 'invalid_response', true)
      }

      return { externalMessageId: messageId }
    } catch (error) {
      if (error instanceof MessagingProviderError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MessagingProviderError('Timeout ao enviar para a WhatsApp Cloud API.', 'timeout', true)
      }
      throw new MessagingProviderError('Falha de rede ao enviar para a WhatsApp Cloud API.', 'network_error', true)
    } finally {
      clearTimeout(timeout)
    }
  }

  private buildPayload(request: ProviderSendRequest) {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.recipient.replace(/\D/g, ''),
      ...(request.replyToExternalId
        ? { context: { message_id: request.replyToExternalId } }
        : {}),
    }

    if (request.contentType === 'TEXT') {
      return {
        ...base,
        type: 'text',
        text: {
          preview_url: false,
          body: requiredString(request.payload.body, 'body'),
        },
      }
    }

    if (request.contentType === 'TEMPLATE') {
      return {
        ...base,
        type: 'template',
        template: request.payload,
      }
    }

    if (request.contentType === 'INTERACTIVE') {
      return {
        ...base,
        type: 'interactive',
        interactive: request.payload,
      }
    }

    throw new MessagingProviderError(
      `Tipo ${request.contentType} ainda nao e suportado para envio.`,
      'unsupported_content_type',
      false,
    )
  }

  private messagesUrl() {
    return `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MessagingProviderError(`Payload sem ${field}.`, 'invalid_payload', false)
  }
  return value.trim()
}

function isRetryableStatus(status: number) {
  return [408, 409, 425, 429].includes(status) || status >= 500
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json()
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
