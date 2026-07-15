import assert from 'node:assert/strict'
import test from 'node:test'

import { renderEscPos } from '../src/escpos/renderer.js'
import { buildDocument, TemplateValidationError } from '../src/templates/v1.js'
import type { ClaimedPrintJob } from '../src/types.js'

test('template de cozinha distingue adicao e nao inventa precos', () => {
  const job = fixture('kitchen-order', 'ORDER_ADDITION')
  const text = renderEscPos(buildDocument(job)).text
  assert.match(text, /ADICAO AO PEDIDO/)
  assert.match(text, /2x Pizza/)
  assert.match(text, /OBS: Sem cebola/)
  assert.equal(text.includes('R$'), false)
  assert.match(text, /JOB JOBTEMPLATE/)
})

test('reimpressao recebe marca visivel e template desconhecido falha fechado', () => {
  const reprint = fixture('kitchen-order', 'REPRINT')
  ;(reprint.payloadSnapshot as Record<string, unknown>).marker = 'REIMPRESSAO'
  const text = renderEscPos(buildDocument(reprint)).text
  assert.match(text, /REIMPRESSAO/)

  const unknown = fixture('arbitrary-code', 'ORDER_INITIAL')
  assert.throws(() => buildDocument(unknown), TemplateValidationError)
})

function fixture(templateKey: string, documentType: string): ClaimedPrintJob {
  const id = 'job-template-12345678'
  return {
    id,
    jobType: documentType,
    templateKey,
    templateVersion: 'v1',
    payloadHash: '0'.repeat(64),
    attemptNumber: 1,
    leaseToken: 'lease-token-value-that-is-long-enough',
    leaseExpiresAt: '2026-07-15T02:00:00.000Z',
    printer: {
      id: 'printer-a',
      name: 'Cozinha',
      connectionType: 'FILE_OR_VIRTUAL',
      address: 'dry-run',
      port: null,
      paperWidth: 58,
      encoding: 'CP860',
    },
    station: { id: 'station-a', code: 'COZINHA', name: 'Cozinha' },
    payloadSnapshot: {
      schemaVersion: 1,
      jobId: id,
      documentType,
      marker: 'ORIGINAL',
      order: {
        id: 'order-a',
        number: '123',
        createdAt: '2026-07-14T20:00:00.000Z',
        serviceType: 'delivery',
        tableCode: null,
        priority: 'normal',
        notes: null,
      },
      station: { id: 'station-a', code: 'COZINHA', name: 'Cozinha' },
      items: [
        {
          productId: 'product-a',
          name: 'Pizza',
          quantity: 2,
          notes: 'Sem cebola',
          options: [{ name: 'Calabresa', quantity: 1 }],
        },
      ],
    },
  }
}
