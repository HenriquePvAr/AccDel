import type { MessagingContentType, OutboundMessageStatus } from '@prisma/client'

interface NormalizedEventBase {
  externalEventId: string
  phoneNumberId: string
  businessAccountId: string
  occurredAt: Date
}

export interface NormalizedInboundMessage extends NormalizedEventBase {
  kind: 'message'
  sender: string
  recipient: string
  contactName: string | null
  contentType: MessagingContentType
  body: string | null
  replyToExternalId: string | null
  metadata: Record<string, unknown>
}

export interface NormalizedMessageStatus extends NormalizedEventBase {
  kind: 'status'
  externalMessageId: string
  recipient: string | null
  status: Extract<OutboundMessageStatus, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>
  errorCode: string | null
  errorMessage: string | null
}

export type NormalizedWhatsappEvent = NormalizedInboundMessage | NormalizedMessageStatus
