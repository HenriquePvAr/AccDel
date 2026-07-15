import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalJson,
  createAgentCredential,
  hashOpaqueToken,
  hashPrintPayload,
  maskPrintPhone,
  sanitizePrintError,
  secureHashMatches,
} from './printing.utils'

test('hash de snapshot e deterministico apesar da ordem das chaves', () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}')
  assert.equal(hashPrintPayload({ a: 1, b: 2 }), hashPrintPayload({ b: 2, a: 1 }))
})

test('credencial do agente tem prefixo identificavel e somente o hash e comparado', () => {
  const credential = createAgentCredential()
  assert.match(credential.token, /^cpa_[a-f0-9]{12}_[A-Za-z0-9_-]+$/)
  assert.equal(credential.token.includes(credential.tokenHash), false)
  assert.equal(
    secureHashMatches(credential.tokenHash, hashOpaqueToken(credential.token)),
    true,
  )
  assert.equal(secureHashMatches(credential.tokenHash, hashOpaqueToken('outro-token')), false)
})

test('erro remoto e sanitizado e telefone e minimizado', () => {
  const sanitized = sanitizePrintError(
    'connection failed\nAuthorization: Bearer abc.def token=super-secret-value',
  )
  assert.equal(sanitized.includes('abc.def'), false)
  assert.equal(sanitized.includes('super-secret-value'), false)
  assert.equal(sanitized.includes('\n'), false)
  assert.equal(maskPrintPhone('+55 (92) 99999-1234').endsWith('1234'), true)
  assert.equal(maskPrintPhone('+55 (92) 99999-1234').includes('99999'), false)
})
