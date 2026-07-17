import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getOperationalStatuses,
  getOrderTiming,
  getVisibleOperationalItems,
  isOrderLate,
  isStatusInOperationalView,
} from './operations-board.ts'

test('projeta preparo e expedicao com o status pronto como handoff compartilhado', () => {
  assert.deepEqual(getOperationalStatuses('preparation'), [
    'in_analysis',
    'in_preparation',
    'ready',
  ])
  assert.deepEqual(getOperationalStatuses('dispatch'), [
    'ready',
    'out_for_delivery',
    'completed',
  ])
  assert.equal(isStatusInOperationalView('ready', 'preparation'), true)
  assert.equal(isStatusInOperationalView('ready', 'dispatch'), true)
  assert.equal(isStatusInOperationalView('out_for_delivery', 'preparation'), false)
})

test('calcula prazo restante e janela de atencao a partir de dueAt', () => {
  const now = Date.parse('2026-07-14T12:00:00.000Z')

  assert.deepEqual(
    getOrderTiming({ status: 'in_preparation', dueAt: '2026-07-14T12:18:00.000Z' }, now),
    { label: '18 min restantes', state: 'normal', minutes: 18 },
  )
  assert.deepEqual(
    getOrderTiming({ status: 'ready', dueAt: '2026-07-14T12:07:00.000Z' }, now),
    { label: '7 min restantes', state: 'warning', minutes: 7 },
  )
})

test('so chama de atrasado depois do vencimento e encerra SLA concluido', () => {
  const now = Date.parse('2026-07-14T12:00:00.000Z')

  assert.deepEqual(
    getOrderTiming({ status: 'out_for_delivery', dueAt: '2026-07-14T11:56:00.000Z' }, now),
    { label: '4 min atrasados', state: 'late', minutes: 4 },
  )
  assert.equal(
    isOrderLate({ status: 'in_analysis', dueAt: '2026-07-14T12:01:00.000Z' }, now),
    false,
  )
  assert.deepEqual(
    getOrderTiming({ status: 'completed', dueAt: '2026-07-14T11:56:00.000Z' }, now),
    { label: 'Encerrado', state: 'closed', minutes: null },
  )
})

test('nao inventa previsao quando dueAt e ausente ou invalido', () => {
  assert.deepEqual(getOrderTiming({ status: 'ready' }), {
    label: 'Sem previsao',
    state: 'unknown',
    minutes: null,
  })
  assert.deepEqual(getOrderTiming({ status: 'ready', dueAt: 'nao-e-data' }), {
    label: 'Sem previsao',
    state: 'unknown',
    minutes: null,
  })
})

test('limita a renderizacao inicial em uma fila de alta densidade', () => {
  const orders = Array.from({ length: 500 }, (_, index) => `order-${index + 1}`)

  assert.equal(getVisibleOperationalItems(orders, false).length, 6)
  assert.equal(getVisibleOperationalItems(orders, true).length, 500)
  assert.equal(orders.length, 500)
})
