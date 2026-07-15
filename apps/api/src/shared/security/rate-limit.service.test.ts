import assert from 'node:assert/strict'
import test from 'node:test'

import { RateLimitService } from './rate-limit.service'

test('limita por dimensoes sem bloquear trafego normal apos a janela', () => {
  const service = new RateLimitService()
  assert.equal(service.consume(['endpoint:ip:a', 'endpoint:user:a'], 2, 1000, 0).allowed, true)
  assert.equal(service.consume(['endpoint:ip:a', 'endpoint:user:a'], 2, 1000, 10).allowed, true)
  const blocked = service.consume(['endpoint:ip:a', 'endpoint:user:a'], 2, 1000, 20)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 1)
  assert.equal(service.consume(['endpoint:ip:a', 'endpoint:user:a'], 2, 1000, 1001).allowed, true)
})
