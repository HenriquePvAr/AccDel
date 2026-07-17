import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { MessagingProviderError } from '../domain/messaging-provider'

@Injectable()
export class MessagingSandboxPolicy {
  constructor(private readonly config: ConfigService) {}

  assertRecipientAllowed(recipient: string) {
    const normalized = normalizeWhatsappRecipient(recipient)
    if (!normalized) {
      throw new MessagingProviderError('Destinatario invalido.', 'invalid_recipient', false)
    }

    if (!this.config.get<boolean>('MESSAGING_SANDBOX_MODE')) return normalized

    const allowed = new Set(
      (this.config.get<string>('MESSAGING_ALLOWED_RECIPIENTS') ?? '')
        .split(/[;,\r\n]+/)
        .map(normalizeWhatsappRecipient)
        .filter((value): value is string => Boolean(value)),
    )
    if (!allowed.has(normalized)) {
      throw new MessagingProviderError(
        'Destinatario bloqueado pelo modo sandbox.',
        'sandbox_recipient_blocked',
        false,
      )
    }
    return normalized
  }
}

export function normalizeWhatsappRecipient(value: string) {
  const digits = value.replace(/\D/g, '')
  return /^\d{8,15}$/.test(digits) ? digits : null
}
