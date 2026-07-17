import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderEscPos } from '../src/escpos/renderer.js'
import { buildDocument } from '../src/templates/v1.js'
import type { ClaimedPrintJob } from '../src/types.js'

type ExampleDefinition = {
  fileName: string
  jobId: string
  jobType: string
  templateKey: string
  width: 58 | 80
  station: { id: string; code: string; name: string }
  snapshot: Record<string, unknown>
}

const outputDirectory = path.join(
  fileURLToPath(new URL('../../../', import.meta.url)),
  'docs',
  'printing',
  'examples',
)

const examples: ExampleDefinition[] = [
  productionExample('kitchen-58mm.txt', 'example-kitchen-58', 58, 'ORDER_INITIAL', 'ORIGINAL'),
  productionExample('kitchen-80mm.txt', 'example-kitchen-80', 80, 'ORDER_INITIAL', 'ORIGINAL'),
  {
    ...productionExample('bar-58mm.txt', 'example-bar-58', 58, 'ORDER_INITIAL', 'ORIGINAL'),
    templateKey: 'bar-order',
    station: { id: 'station-example-bar', code: 'BAR', name: 'Bar Exemplo' },
    snapshot: snapshot('example-bar-58', 'ORDER_INITIAL', 'ORIGINAL', {
      station: { id: 'station-example-bar', code: 'BAR', name: 'Bar Exemplo' },
      items: [
        item('Suco de cupuacu', 2, 'Pouco gelo'),
        item('Agua sem gas', 1, null),
      ],
    }),
  },
  {
    fileName: 'cashier-80mm.txt',
    jobId: 'example-cashier-80',
    jobType: 'CASHIER_RECEIPT',
    templateKey: 'cashier-receipt',
    width: 80,
    station: { id: 'station-example-cashier', code: 'CASHIER', name: 'Caixa Exemplo' },
    snapshot: snapshot('example-cashier-80', 'CASHIER_RECEIPT', 'ORIGINAL', {
      station: { id: 'station-example-cashier', code: 'CASHIER', name: 'Caixa Exemplo' },
      items: [
        { ...item('Hamburguer da casa', 2, null), unitPrice: 28.5, totalPrice: 57 },
        { ...item('Suco de cupuacu', 1, null), unitPrice: 9, totalPrice: 9 },
      ],
      financial: {
        subtotal: 66,
        deliveryFee: 6,
        discount: 2,
        total: 70,
        paymentMethod: 'PIX',
        paymentStatus: 'PAGO',
      },
    }),
  },
  {
    fileName: 'dispatch-80mm.txt',
    jobId: 'example-dispatch-80',
    jobType: 'DISPATCH_ORDER',
    templateKey: 'dispatch-order',
    width: 80,
    station: { id: 'station-example-dispatch', code: 'DISPATCH', name: 'Expedicao Exemplo' },
    snapshot: snapshot('example-dispatch-80', 'DISPATCH_ORDER', 'ORIGINAL', {
      station: { id: 'station-example-dispatch', code: 'DISPATCH', name: 'Expedicao Exemplo' },
      dispatch: {
        customerName: 'CLIENTE FICTICIO',
        maskedPhone: '(**) *****-0042',
        address: 'Rua Exemplo, 100 - Bairro Demonstracao',
        addressReference: 'Endereco inteiramente ficticio',
        paymentMethod: 'PIX',
        amountToCollect: 0,
        driverName: 'ENTREGADOR FICTICIO',
      },
    }),
  },
  productionExample('addition-58mm.txt', 'example-addition-58', 58, 'ORDER_ADDITION', 'ORIGINAL'),
  productionExample(
    'cancellation-58mm.txt',
    'example-cancellation-58',
    58,
    'ORDER_CANCELLATION',
    'ORIGINAL',
  ),
  productionExample('reprint-58mm.txt', 'example-reprint-58', 58, 'REPRINT', 'REIMPRESSAO'),
]

await mkdir(outputDirectory, { recursive: true })
for (const definition of examples) {
  const rendered = renderEscPos(buildDocument(toJob(definition)))
  await writeFile(path.join(outputDirectory, definition.fileName), rendered.text, 'utf8')
}

function productionExample(
  fileName: string,
  jobId: string,
  width: 58 | 80,
  documentType: string,
  marker: 'ORIGINAL' | 'REIMPRESSAO',
): ExampleDefinition {
  const station = { id: 'station-example-kitchen', code: 'KITCHEN', name: 'Cozinha Exemplo' }
  return {
    fileName,
    jobId,
    jobType: documentType,
    templateKey: 'kitchen-order',
    width,
    station,
    snapshot: snapshot(jobId, documentType, marker, {
      station,
      items: [
        {
          ...item('Hamburguer da casa', documentType === 'ORDER_ADDITION' ? 1 : 2, 'Sem cebola'),
          options: [{ name: 'Queijo adicional', quantity: 1 }],
        },
        ...(documentType === 'ORDER_CANCELLATION' ? [] : [item('Batata pequena', 1, null)]),
      ],
    }),
  }
}

function snapshot(
  jobId: string,
  documentType: string,
  marker: 'ORIGINAL' | 'REIMPRESSAO',
  overrides: Record<string, unknown>,
) {
  return {
    schemaVersion: 1,
    jobId,
    documentType,
    marker,
    order: {
      id: 'order-example-2026-0042',
      number: '0042',
      createdAt: '2026-07-15T15:30:00.000Z',
      serviceType: 'delivery',
      tableCode: null,
      priority: 'normal',
      notes: 'DADOS FICTICIOS PARA VALIDACAO',
    },
    station: { id: null, code: null, name: null },
    items: [],
    ...overrides,
  }
}

function item(name: string, quantity: number, notes: string | null) {
  return {
    productId: null,
    name,
    quantity,
    notes,
    options: [] as Array<{ name: string; quantity: number }>,
  }
}

function toJob(definition: ExampleDefinition): ClaimedPrintJob {
  return {
    id: definition.jobId,
    jobType: definition.jobType,
    templateKey: definition.templateKey,
    templateVersion: 'v1',
    payloadSnapshot: definition.snapshot,
    payloadHash: 'example-only',
    attemptNumber: 1,
    leaseToken: 'example-only',
    leaseExpiresAt: '2026-07-15T16:00:00.000Z',
    printer: {
      id: `printer-example-${definition.width}`,
      name: `Impressora ${definition.width} mm de exemplo`,
      connectionType: 'FILE_OR_VIRTUAL',
      address: 'dry-run',
      port: null,
      paperWidth: definition.width,
      encoding: 'CP860',
    },
    station: definition.station,
  }
}
