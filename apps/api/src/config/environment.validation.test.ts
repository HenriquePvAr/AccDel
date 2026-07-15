import assert from 'node:assert/strict'
import test from 'node:test'

import { validateEnvironment } from './environment.validation'

test('falha cedo quando Cloud ou NVIDIA sao selecionados sem credenciais', () => {
  assert.throws(() => validateEnvironment({ WHATSAPP_PROVIDER: 'cloud' }), /WHATSAPP_PHONE_NUMBER_ID/)
  assert.throws(() => validateEnvironment({ AI_PROVIDER: 'nvidia' }), /NVIDIA_API_KEY/)
})

test('converte limites numericos e aceita providers desativados', () => {
  const result = validateEnvironment({
    WHATSAPP_OUTBOX_MAX_ATTEMPTS: '7',
    NVIDIA_MAX_CONCURRENT: '3',
  })
  assert.equal(result.WHATSAPP_OUTBOX_MAX_ATTEMPTS, 7)
  assert.equal(result.NVIDIA_MAX_CONCURRENT, 3)
})

test('rejeita URL ficticia ou rota incorreta para webhook Cloud', () => {
  const base = {
    WHATSAPP_PROVIDER: 'cloud',
    WHATSAPP_PHONE_NUMBER_ID: '12345',
    WHATSAPP_BUSINESS_ACCOUNT_ID: '67890',
    WHATSAPP_ACCESS_TOKEN: 'token-realista-com-comprimento-seguro',
    WHATSAPP_VERIFY_TOKEN: 'verify-token-realista-e-bem-longo',
    WHATSAPP_APP_SECRET: 'app-secret-realista-e-bem-longo',
    WHATSAPP_STORE_ID: 'store-main',
    WHATSAPP_GRAPH_API_VERSION: 'v23.0',
  }
  assert.throws(() => validateEnvironment({
    ...base,
    WHATSAPP_WEBHOOK_PUBLIC_URL: 'https://api.example.invalid/webhooks/whatsapp',
  }))
  assert.throws(() => validateEnvironment({
    ...base,
    WHATSAPP_WEBHOOK_PUBLIC_URL: 'https://api.cain.test/rota-errada',
  }))
})
