import assert from 'node:assert/strict'
import test from 'node:test'
import { ConfigService } from '@nestjs/config'

import { hashToken, publicTrackingBaseUrl, roundPublicCoordinate } from './public-tracking.service'

test('tracking persiste somente hash deterministico do token', () => {
  const raw = '7N_RandomTokenWithEnoughEntropyForATest_1234567890'
  const hash = hashToken(raw)
  assert.match(hash, /^[a-f\d]{64}$/)
  assert.notEqual(hash, raw)
  assert.notEqual(hashToken(`${raw}x`), hash)
})

test('link publico usa a API e nunca uma rota inexistente do admin', () => {
  assert.equal(
    publicTrackingBaseUrl(
      new ConfigService<Record<string | symbol, unknown>>({
        PUBLIC_API_URL: 'https://api.cain.test/',
      }),
    ),
    'https://api.cain.test',
  )
  assert.equal(
    publicTrackingBaseUrl(
      new ConfigService<Record<string | symbol, unknown>>({
        WHATSAPP_WEBHOOK_PUBLIC_URL: 'https://hooks.cain.test/webhooks/whatsapp',
      }),
    ),
    'https://hooks.cain.test',
  )
})

test('coordenada publica perde precisao para cerca de cem metros', () => {
  assert.equal(roundPublicCoordinate(-3.1019234), -3.102)
  assert.equal(roundPublicCoordinate(-60.0217123), -60.022)
})
