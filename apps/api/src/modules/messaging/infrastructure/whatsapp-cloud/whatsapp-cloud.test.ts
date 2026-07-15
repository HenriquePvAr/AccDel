import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'

import { normalizeWhatsappCloudPayload } from './whatsapp-cloud-normalizer'
import { verifyMetaSignature } from './whatsapp-cloud-webhook-security.service'

test('valida a assinatura oficial sha256 sobre os bytes exatos do corpo', () => {
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8')
  const secret = 'realistic-app-secret-for-test-only'
  const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`

  assert.doesNotThrow(() => verifyMetaSignature(rawBody, signature, secret))
  assert.throws(() => verifyMetaSignature(Buffer.from('{}'), signature, secret))
  assert.throws(() => verifyMetaSignature(rawBody, 'sha256=abcd', secret))
})

test('normaliza mensagens e status sem acoplar o dominio ao payload da Meta', () => {
  const events = normalizeWhatsappCloudPayload({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: 'phone-1' },
          contacts: [{ wa_id: '5592999999999', profile: { name: 'Cliente' } }],
          messages: [{
            id: 'wamid.inbound-1',
            from: '5592999999999',
            timestamp: '1784073600',
            type: 'text',
            text: { body: 'Quero um lanche' },
          }],
          statuses: [{
            id: 'wamid.outbound-1',
            recipient_id: '5592999999999',
            timestamp: '1784073601',
            status: 'delivered',
          }],
        },
      }],
    }],
  })

  assert.equal(events.length, 2)
  assert.deepEqual(events[0], {
    kind: 'message',
    externalEventId: 'wamid.inbound-1',
    phoneNumberId: 'phone-1',
    businessAccountId: 'waba-1',
    occurredAt: new Date(1_784_073_600_000),
    sender: '5592999999999',
    recipient: 'phone-1',
    contactName: 'Cliente',
    contentType: 'TEXT',
    body: 'Quero um lanche',
    replyToExternalId: null,
    metadata: {},
  })
  assert.equal(events[1]?.kind, 'status')
  if (events[1]?.kind === 'status') assert.equal(events[1].status, 'DELIVERED')
})
