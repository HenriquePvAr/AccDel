import assert from 'node:assert/strict'
import test from 'node:test'

import type { StoreScopedRequest } from './store-context'
import { resolveStoreContextFromRequest } from './store-context'

test('webhook Cloud ignora header de tenant controlado pelo caller', () => {
  const previous = process.env.WHATSAPP_STORE_ID
  process.env.WHATSAPP_STORE_ID = 'trusted-store'
  try {
    const context = resolveStoreContextFromRequest({
      url: '/webhooks/whatsapp',
      headers: { 'x-cain-store-id': 'attacker-store', host: 'api.example.test' },
    } as unknown as StoreScopedRequest)
    assert.deepEqual(context, {
      storeId: 'trusted-store',
      source: 'webhook',
      host: 'api.example.test',
    })
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_STORE_ID
    else process.env.WHATSAPP_STORE_ID = previous
  }
})

test('fallback da loja padrao existe no staging local e falha fechado em producao', () => {
  const previous = process.env.APP_ENV
  try {
    process.env.APP_ENV = 'staging'
    assert.equal(resolveStoreContextFromRequest({
      url: '/auth/login',
      headers: { host: 'localhost:3333' },
    } as unknown as StoreScopedRequest).storeId, 'store_main')

    process.env.APP_ENV = 'production'
    assert.throws(() => resolveStoreContextFromRequest({
      url: '/auth/login',
      headers: { host: 'localhost:3333' },
    } as unknown as StoreScopedRequest))
  } finally {
    if (previous === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = previous
  }
})
