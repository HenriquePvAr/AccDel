import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatColumns,
  normalizePrintableText,
  renderEscPos,
  wrapText,
} from '../src/escpos/renderer.js'

test('renderiza 58 e 80 mm com comandos ESC/POS, corte e quebra deterministica', () => {
  const text = 'Observacao muito longa com acucar, cafe, pao e coracao para validar quebra de linha.'
  const render = (paperWidth: 58 | 80) =>
    renderEscPos({
      jobId: `job-render-${paperWidth}`,
      paperWidth,
      encoding: 'CP860',
      cut: true,
      blocks: [
        { text: 'PEDIDO #123', align: 'center', bold: true, width: 2 },
        { text },
      ],
    })
  const narrow = render(58)
  const wide = render(80)
  assert.deepEqual(Array.from(narrow.bytes.slice(0, 2)), [0x1b, 0x40])
  assert.deepEqual(Array.from(narrow.bytes.slice(-3)), [0x1d, 0x56, 0])
  assert.equal(narrow.text.split('\n').every((line) => line.length <= 32), true)
  assert.equal(wide.text.split('\n').every((line) => line.length <= 48), true)
  assert.notEqual(narrow.contentHash, wide.contentHash)
})

test('preserva caracteres PT-BR mapeados e substitui emoji sem ambiguidade', () => {
  const normalized = normalizePrintableText('ação, café, pão, açúcar 😀', 'CP860')
  assert.equal(normalized, 'ação, café, pão, açúcar ?')
  const rendered = renderEscPos({
    jobId: 'job-encoding',
    paperWidth: 80,
    encoding: 'CP860',
    cut: false,
    blocks: [{ text: 'ç' }],
  })
  assert.equal(rendered.bytes.includes(0x87), true)
  assert.equal(normalizePrintableText('ação', 'ASCII'), 'acao')
})

test('colunas e textos extremos respeitam a largura', () => {
  assert.equal(formatColumns('TOTAL', 'R$ 123,45', 20).length, 20)
  assert.equal(wrapText('x'.repeat(100), 32, 'CP860').every((line) => line.length <= 32), true)
})
