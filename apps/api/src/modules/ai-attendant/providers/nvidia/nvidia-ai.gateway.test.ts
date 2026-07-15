import assert from 'node:assert/strict'
import test from 'node:test'

import { ConfigService } from '@nestjs/config'

import { NvidiaAiGateway } from './nvidia-ai.gateway'

const request = {
  messages: [{ role: 'user' as const, content: 'Cliente perguntou se ha pizza de calabresa.' }],
}

test('cada retry NVIDIA executa uma nova tentativa HTTP controlada', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    if (calls < 3) return new Response(JSON.stringify({ error: { code: 429 } }), { status: 429 })
    return new Response(JSON.stringify({
      model: 'test-model',
      choices: [{ message: { role: 'assistant', content: 'Disponibilidade deve ser consultada por tool.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 8 },
    }), { status: 200 })
  }
  try {
    const result = await new NvidiaAiGateway(config()).complete(request)
    assert.equal(calls, 3)
    assert.equal(result.message.role, 'assistant')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('circuit breaker abre depois de falhas consecutivas sem vazar payload', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(JSON.stringify({ error: { message: 'conteudo-sensivel' } }), { status: 400 })
  }
  try {
    const gateway = new NvidiaAiGateway(config())
    for (let index = 0; index < 5; index += 1) {
      await assert.rejects(() => gateway.complete(request), (error: unknown) => {
        assert.equal(error instanceof Error && error.message.includes('conteudo-sensivel'), false)
        return true
      })
    }
    await assert.rejects(() => gateway.complete(request))
    assert.equal(calls, 5)
  } finally {
    globalThis.fetch = originalFetch
  }
})

function config() {
  return new ConfigService({
    NVIDIA_API_KEY: 'test-key-not-a-real-secret',
    NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
    NVIDIA_MODEL: 'test-model',
    NVIDIA_TIMEOUT_MS: 1_000,
    NVIDIA_MAX_REQUESTS_PER_MINUTE: 35,
    NVIDIA_MAX_CONCURRENT_REQUESTS: 2,
    NVIDIA_MAX_OUTPUT_TOKENS: 128,
  })
}
