import assert from 'node:assert/strict'
import test from 'node:test'

import { AiToolRegistry } from './ai-tool.registry'

const context = {
  storeId: 'store-a',
  conversationId: 'conversation-a',
  accountId: 'account-a',
  customerId: 'customer-a',
  inboundEventId: 'event-a',
  inboundExternalId: 'wamid-a',
  explicitlyConfirmed: false,
}

test('rejeita tenant vindo do modelo antes de executar a tool', async () => {
  let searches = 0
  const registry = new AiToolRegistry(
    { searchMenu: () => { searches += 1 } } as never,
    auditRepository(false) as never,
  )
  const result = await registry.execute({
    executionId: 'execution-a',
    name: 'search_menu',
    rawArguments: JSON.stringify({ query: 'pizza', storeId: 'other-store' }),
    context,
  })
  assert.deepEqual(result, { ok: false, code: 'invalid_arguments' })
  assert.equal(searches, 0)
})

test('ignora repeticao canonica de tool mutante na mesma execucao', async () => {
  let additions = 0
  const repository = auditRepository(true)
  const registry = new AiToolRegistry(
    { addItem: () => { additions += 1 } } as never,
    repository as never,
  )
  const result = await registry.execute({
    executionId: 'execution-a',
    name: 'add_item_to_draft',
    rawArguments: '{ "quantity": 1, "productId": "product-a" }',
    context,
  })
  assert.deepEqual(result, { ok: false, code: 'duplicate_tool_call_ignored' })
  assert.equal(additions, 0)
  assert.equal(repository.completedCode, 'duplicate_tool_call_ignored')
})

function auditRepository(duplicate: boolean) {
  return {
    completedCode: '',
    createToolCall: () => Promise.resolve({ id: 'audit-a', argumentsHash: 'hash-a' }),
    hasSuccessfulToolCall: () => Promise.resolve(duplicate),
    getOperationalStatus: () => Promise.resolve('AI_ACTIVE'),
    completeToolCall(_id: string, _status: string, code: string) {
      this.completedCode = code
      return Promise.resolve(null)
    },
  }
}
