import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'

import { normalizeWhatsappCloudPayload } from './whatsapp-cloud-normalizer'
import { WhatsappCloudWebhookSecurityService, verifyMetaSignature } from './whatsapp-cloud-webhook-security.service'

test('valida a assinatura oficial sha256 sobre os bytes exatos do corpo', () => {
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8')
  const secret = 'realistic-app-secret-for-test-only'
  const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`

  assert.doesNotThrow(() => verifyMetaSignature(rawBody, signature, secret))
  assert.throws(() => verifyMetaSignature(Buffer.from('{}'), signature, secret))
  assert.throws(() => verifyMetaSignature(Buffer.from('{ "object": "whatsapp_business_account" }'), signature, secret))
  assert.throws(() => verifyMetaSignature(rawBody, 'sha256=abcd', secret))
  assert.throws(() => verifyMetaSignature(rawBody, signature.replace('sha256=', 'SHA256='), secret))
  assert.throws(() => verifyMetaSignature(rawBody, undefined, secret))

  const unicodeBody = Buffer.from('{"text":"calabresa ç"}', 'utf8')
  const unicodeSignature = `sha256=${createHmac('sha256', secret).update(unicodeBody).digest('hex')}`
  assert.doesNotThrow(() => verifyMetaSignature(unicodeBody, unicodeSignature, secret))
})

test('rejeita corpo vazio, payload excessivo e content-type incorreto antes da normalizacao', () => {
  const secret = 'realistic-app-secret-for-test-only'
  const security = new WhatsappCloudWebhookSecurityService({
    isEnabled: () => true,
    appSecret: secret,
    maxPayloadBytes: 8,
  } as never)
  assert.throws(() => security.verifySignature({
    contentType: 'application/json',
    signature: `sha256=${createHmac('sha256', secret).update(Buffer.alloc(0)).digest('hex')}`,
    rawBody: Buffer.alloc(0),
  }))
  assert.throws(() => security.verifySignature({
    contentType: 'text/plain',
    signature: 'sha256=00',
    rawBody: Buffer.from('{}'),
  }))
  const large = Buffer.from('{"x":123456789}')
  assert.throws(() => security.verifySignature({
    contentType: 'application/json; charset=utf-8',
    signature: `sha256=${createHmac('sha256', secret).update(large).digest('hex')}`,
    rawBody: large,
  }))
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

test('normaliza multiplos eventos interativos, localizacao, midia e desconhecidos com seguranca', () => {
  const events = normalizeWhatsappCloudPayload({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: 'phone-1' },
          messages: [
            {
              id: 'wamid.interactive',
              from: '+55 (92) 99999-9999',
              timestamp: '1784073600',
              type: 'interactive',
              interactive: { button_reply: { id: 'confirm', title: 'Confirmar' } },
            },
            {
              id: 'wamid.location',
              from: '5592999999999',
              timestamp: '1784073601',
              type: 'location',
              location: { latitude: -3.1, longitude: -60.0 },
            },
            {
              id: 'wamid.image',
              from: '5592999999999',
              timestamp: '1784073602',
              type: 'image',
              image: { id: 'media-test-id', caption: 'comprovante' },
            },
            {
              id: 'wamid.unknown',
              from: '5592999999999',
              timestamp: '1784073603',
              type: 'future_type',
              future_type: {},
            },
          ],
        },
      }],
    }],
  })
  assert.deepEqual(events.map((event) => event.kind === 'message' ? event.contentType : event.status), [
    'INTERACTIVE',
    'LOCATION',
    'IMAGE',
    'UNKNOWN',
  ])
  assert.equal(events[0]?.kind === 'message' ? events[0].body : null, 'Confirmar')
  assert.equal(events[2]?.kind === 'message' ? events[2].metadata.mediaId : null, 'media-test-id')
  assert.deepEqual(normalizeWhatsappCloudPayload({ object: 'outro', entry: [] }), [])
  assert.deepEqual(normalizeWhatsappCloudPayload({ object: 'whatsapp_business_account', entry: [{}] }), [])
})
