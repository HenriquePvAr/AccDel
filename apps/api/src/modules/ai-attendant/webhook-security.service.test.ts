import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyWebhookSecurity } from './webhook-security.service'
import { buildWebhookUrl } from './whatsapp-provider.factory'

const now = Date.parse('2026-07-14T20:00:00.000Z')
const secret = 'a-secure-webhook-secret-with-32-characters'
const validPayload = {
  event: 'MESSAGES_UPSERT',
  data: {
    messageTimestamp: Math.floor(now / 1000),
    key: { id: 'message-1' },
  },
}

test('Evolution nunca transporta segredo, query ou credencial na URL do webhook', () => {
  assert.equal(
    buildWebhookUrl('https://gateway.cain.test/evolution/webhook'),
    'https://gateway.cain.test/evolution/webhook',
  )
  assert.throws(() => buildWebhookUrl('https://gateway.cain.test/webhook?token=secret'))
  assert.throws(() => buildWebhookUrl('https://user:secret@gateway.cain.test/webhook'))
})

test('aceita evento valido autenticado uma unica vez na borda', () => {
  const result = verifyWebhookSecurity(
    { contentType: 'application/json', token: secret, payload: validPayload },
    { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
  )
  assert.equal(result.event, 'MESSAGES_UPSERT')
})

test('rejeita token ausente ou invalido', () => {
  assert.throws(() =>
    verifyWebhookSecurity(
      { contentType: 'application/json', payload: validPayload },
      { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
    ),
  )
  assert.throws(() =>
    verifyWebhookSecurity(
      { contentType: 'application/json', token: 'wrong-token', payload: validPayload },
      { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
    ),
  )
})

test('rejeita timestamp expirado, payload excessivo e content-type incorreto', () => {
  const expired = {
    ...validPayload,
    data: { messageTimestamp: Math.floor((now - 301_000) / 1000) },
  }
  assert.throws(() =>
    verifyWebhookSecurity(
      { contentType: 'application/json', token: secret, payload: expired },
      { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
    ),
  )
  assert.throws(() =>
    verifyWebhookSecurity(
      {
        contentType: 'application/json',
        token: secret,
        payload: { ...validPayload, padding: 'x'.repeat(5000) },
      },
      { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
    ),
  )
  assert.throws(() =>
    verifyWebhookSecurity(
      { contentType: 'text/plain', token: secret, payload: validPayload },
      { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
    ),
  )
})

test('evento desconhecido autenticado e aceito para descarte idempotente', () => {
  const result = verifyWebhookSecurity(
    { contentType: 'application/json', token: secret, payload: { event: 'UNKNOWN' } },
    { secret, maxPayloadBytes: 4096, maxAgeSeconds: 300, now },
  )
  assert.equal(result.event, 'UNKNOWN')
})
