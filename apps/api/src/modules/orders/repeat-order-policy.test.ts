import assert from 'node:assert/strict'
import test from 'node:test'

import { extractRepeatItemSelections } from './repeat-order-policy'

test('extrai somente ids, adicionais e quantidades do pedido historico', () => {
  const result = extractRepeatItemSelections([
    {
      id: 'old-item',
      productId: 'product-current',
      name: 'Nome historico',
      quantity: 2,
      options: [
        {
          groupId: 'group-current',
          optionId: 'option-current',
          quantity: 1,
          name: 'Nome antigo',
          price: 999,
        },
      ],
    },
  ])

  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.selections, [
    {
      orderItemId: 'old-item',
      productId: 'product-current',
      quantity: 2,
      options: [
        { groupId: 'group-current', optionId: 'option-current', quantity: 1 },
      ],
    },
  ])
  assert.equal('price' in result.selections[0], false)
  assert.equal('paymentStatus' in result.selections[0], false)
})

test('pedido antigo com item inexistente exige revisao estruturada', () => {
  const result = extractRepeatItemSelections([
    { id: 'old-item', productId: null, name: 'Removido', quantity: 1, options: [] },
  ])

  assert.equal(result.selections.length, 0)
  assert.equal(result.issues[0]?.orderItemId, 'old-item')
  assert.match(result.issues[0]?.reason ?? '', /removido/i)
})

test('adicional sem identificador atual exige revisao', () => {
  const result = extractRepeatItemSelections([
    {
      id: 'old-item',
      productId: 'product-current',
      name: 'Produto',
      quantity: 1,
      options: [{ name: 'Adicional removido', price: 2 }],
    },
  ])

  assert.equal(result.selections.length, 0)
  assert.match(result.issues[0]?.reason ?? '', /identificador/i)
})
