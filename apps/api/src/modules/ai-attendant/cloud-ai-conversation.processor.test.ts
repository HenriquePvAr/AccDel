import assert from 'node:assert/strict'
import test from 'node:test'

import { isExplicitOrderConfirmation, shouldSuppressAiReply } from './cloud-ai-conversation.processor'

test('reconhece apenas confirmacoes explicitas e deterministicas', () => {
  for (const phrase of ['confirmar', 'Confirmo!', 'pode fechar', 'pode fazer o pedido', 'sim, está correto']) {
    assert.equal(isExplicitOrderConfirmation(phrase), true, phrase)
  }
  for (const phrase of ['sim', 'talvez', 'quanto custa?', 'pode ser', 'esta correto?']) {
    assert.equal(isExplicitOrderConfirmation(phrase), false, phrase)
  }
})

test('handoff e estados humanos sempre suprimem a resposta final da IA', () => {
  assert.equal(shouldSuppressAiReply('AI_ACTIVE'), false)
  for (const status of ['WAITING_HUMAN', 'HUMAN_ACTIVE', 'PAUSED', 'CLOSED']) {
    assert.equal(shouldSuppressAiReply(status), true, status)
  }
})
