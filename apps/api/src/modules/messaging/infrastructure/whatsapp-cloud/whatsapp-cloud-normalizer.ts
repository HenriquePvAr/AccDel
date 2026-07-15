import type { MessagingContentType, OutboundMessageStatus } from '@prisma/client'

import type { NormalizedWhatsappEvent } from '../../domain/normalized-event'

export function normalizeWhatsappCloudPayload(payload: unknown): NormalizedWhatsappEvent[] {
  if (!isRecord(payload) || payload.object !== 'whatsapp_business_account') {
    return []
  }

  const events: NormalizedWhatsappEvent[] = []
  for (const entry of asRecords(payload.entry)) {
    const businessAccountId = readString(entry.id) ?? ''
    for (const change of asRecords(entry.changes)) {
      if (change.field !== 'messages' || !isRecord(change.value)) {
        continue
      }

      const value = change.value
      const metadata = isRecord(value.metadata) ? value.metadata : {}
      const phoneNumberId = readString(metadata.phone_number_id) ?? ''
      if (!businessAccountId || !phoneNumberId) {
        continue
      }

      const contactsByWaId = new Map(
        asRecords(value.contacts).flatMap((contact) => {
          const waId = readString(contact.wa_id)
          const profile = isRecord(contact.profile) ? contact.profile : {}
          return waId ? [[waId, readString(profile.name)] as const] : []
        }),
      )

      for (const message of asRecords(value.messages)) {
        const normalized = normalizeMessage(
          message,
          phoneNumberId,
          businessAccountId,
          contactsByWaId,
        )
        if (normalized) events.push(normalized)
      }

      for (const status of asRecords(value.statuses)) {
        const normalized = normalizeStatus(status, phoneNumberId, businessAccountId)
        if (normalized) events.push(normalized)
      }
    }
  }

  return events
}

function normalizeMessage(
  message: Record<string, unknown>,
  phoneNumberId: string,
  businessAccountId: string,
  contacts: Map<string, string | null>,
): NormalizedWhatsappEvent | null {
  const id = readString(message.id)
  const sender = normalizePhone(readString(message.from))
  if (!id || !sender) return null

  const type = readString(message.type) ?? 'unknown'
  const content = extractContent(message, type)
  const context = isRecord(message.context) ? message.context : {}

  return {
    kind: 'message',
    externalEventId: id,
    phoneNumberId,
    businessAccountId,
    occurredAt: parseMetaTimestamp(message.timestamp),
    sender,
    recipient: phoneNumberId,
    contactName: contacts.get(sender) ?? null,
    contentType: mapContentType(type),
    body: content.body,
    replyToExternalId: readString(context.id),
    metadata: content.metadata,
  }
}

function normalizeStatus(
  status: Record<string, unknown>,
  phoneNumberId: string,
  businessAccountId: string,
): NormalizedWhatsappEvent | null {
  const externalMessageId = readString(status.id)
  const statusName = mapStatus(readString(status.status))
  if (!externalMessageId || !statusName) return null

  const occurredAt = parseMetaTimestamp(status.timestamp)
  const errors = asRecords(status.errors)
  const firstError = errors[0]

  return {
    kind: 'status',
    externalEventId: `${externalMessageId}:status:${statusName}:${occurredAt.getTime()}`,
    phoneNumberId,
    businessAccountId,
    occurredAt,
    externalMessageId,
    recipient: normalizePhone(readString(status.recipient_id)),
    status: statusName,
    errorCode: firstError ? String(firstError.code ?? 'provider_error') : null,
    errorMessage: firstError ? sanitizeProviderText(readString(firstError.title)) : null,
  }
}

function extractContent(message: Record<string, unknown>, type: string) {
  const typed = isRecord(message[type]) ? message[type] : {}

  if (type === 'text') {
    return { body: readString(typed.body), metadata: {} }
  }
  if (type === 'button') {
    return {
      body: readString(typed.text) ?? readString(typed.payload),
      metadata: { buttonPayload: readString(typed.payload) },
    }
  }
  if (type === 'interactive') {
    const buttonReply = isRecord(typed.button_reply) ? typed.button_reply : {}
    const listReply = isRecord(typed.list_reply) ? typed.list_reply : {}
    return {
      body:
        readString(buttonReply.title) ??
        readString(listReply.title) ??
        readString(buttonReply.id) ??
        readString(listReply.id),
      metadata: {
        replyId: readString(buttonReply.id) ?? readString(listReply.id),
      },
    }
  }

  return {
    body: readString(typed.caption),
    metadata: { mediaId: readString(typed.id), sourceType: type },
  }
}

function mapContentType(value: string): MessagingContentType {
  const mapping: Record<string, MessagingContentType> = {
    text: 'TEXT',
    button: 'INTERACTIVE',
    interactive: 'INTERACTIVE',
    image: 'IMAGE',
    document: 'DOCUMENT',
    location: 'LOCATION',
  }
  return mapping[value] ?? 'UNKNOWN'
}

function mapStatus(value: string | null): Extract<
  OutboundMessageStatus,
  'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
> | null {
  if (value === 'sent') return 'SENT'
  if (value === 'delivered') return 'DELIVERED'
  if (value === 'read') return 'READ'
  if (value === 'failed') return 'FAILED'
  return null
}

function parseMetaTimestamp(value: unknown) {
  const seconds = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return Number.isFinite(seconds) ? new Date(seconds * 1_000) : new Date()
}

function sanitizeProviderText(value: string | null) {
  return value?.replace(/[\r\n\t]+/g, ' ').slice(0, 240) ?? null
}

function normalizePhone(value: string | null) {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits || null
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
