import type { MessagingAccount, MessagingContentType } from '@prisma/client'

export interface ProviderSendRequest {
  account: MessagingAccount
  recipient: string
  contentType: MessagingContentType
  payload: Record<string, unknown>
  replyToExternalId?: string | null
}

export interface ProviderSendResult {
  externalMessageId: string
}

export interface MessagingProvider {
  readonly providerName: string
  send(request: ProviderSendRequest): Promise<ProviderSendResult>
}

export class MessagingProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'MessagingProviderError'
  }
}
