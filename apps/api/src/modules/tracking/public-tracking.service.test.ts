import assert from 'node:assert/strict'
import test from 'node:test'

import { hashToken, roundPublicCoordinate } from './public-tracking.service'

test('tracking persiste somente hash deterministico do token', () => {
  const raw = '7N_RandomTokenWithEnoughEntropyForATest_1234567890'
  const hash = hashToken(raw)
  assert.match(hash, /^[a-f\d]{64}$/)
  assert.notEqual(hash, raw)
  assert.notEqual(hashToken(`${raw}x`), hash)
})

test('coordenada publica perde precisao para cerca de cem metros', () => {
  assert.equal(roundPublicCoordinate(-3.1019234), -3.102)
  assert.equal(roundPublicCoordinate(-60.0217123), -60.022)
})
