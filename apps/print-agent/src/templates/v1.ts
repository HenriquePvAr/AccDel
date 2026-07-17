import { formatColumns } from '../escpos/renderer.js'
import type { ClaimedPrintJob, EscPosBlock, EscPosDocument } from '../types.js'

interface SnapshotItem {
  productId: string | null
  name: string
  quantity: number
  notes: string | null
  options: Array<{ name: string; quantity: number }>
  unitPrice?: number
  totalPrice?: number
}

interface Snapshot {
  schemaVersion: 1
  jobId: string
  documentType: string
  marker: 'ORIGINAL' | 'REIMPRESSAO'
  order: {
    id: string | null
    number: string
    createdAt: string
    serviceType: string
    tableCode: string | null
    priority: string
    notes: string | null
  }
  station: { id: string | null; code: string | null; name: string | null }
  items: SnapshotItem[]
  financial?: {
    subtotal: number
    deliveryFee: number
    discount: number
    total: number
    paymentMethod: string
    paymentStatus: string
  }
  dispatch?: {
    customerName: string
    maskedPhone: string
    address: string | null
    addressReference: string | null
    paymentMethod: string
    amountToCollect: number
    driverName: string | null
  }
}

export class TemplateValidationError extends Error {
  readonly code = 'INVALID_OR_UNKNOWN_TEMPLATE'
}

export function buildDocument(job: ClaimedPrintJob): EscPosDocument {
  if (job.templateVersion !== 'v1') {
    throw new TemplateValidationError(`Unknown template version ${job.templateVersion}.`)
  }
  const snapshot = parseSnapshot(job.payloadSnapshot, job.id)
  const columns = job.printer.paperWidth === 58 ? 32 : 48
  const blocks = header(snapshot, job.id, columns)

  switch (job.templateKey) {
    case 'kitchen-order':
    case 'bar-order':
      blocks.push(...productionBlocks(snapshot, columns))
      break
    case 'cashier-receipt':
    case 'customer-receipt':
      blocks.push(...receiptBlocks(snapshot, columns, job.templateKey === 'customer-receipt'))
      break
    case 'dispatch-order':
      blocks.push(...dispatchBlocks(snapshot, columns))
      break
    case 'test-page':
      blocks.push(...testBlocks(job, columns))
      break
    default:
      throw new TemplateValidationError(`Unknown template key ${job.templateKey}.`)
  }

  blocks.push({ text: `JOB ${shortJobId(job.id)}`, align: 'center' })
  return {
    jobId: job.id,
    paperWidth: job.printer.paperWidth,
    encoding: job.printer.encoding,
    blocks,
    cut: true,
  }
}

function header(snapshot: Snapshot, jobId: string, columns: number): EscPosBlock[] {
  const eventLabel: Record<string, string> = {
    ORDER_INITIAL: 'PEDIDO INICIAL',
    ORDER_ADDITION: 'ADICAO AO PEDIDO',
    ORDER_REMOVAL: 'REMOCAO DE ITEM',
    ORDER_CORRECTION: 'CORRECAO DO PEDIDO',
    ORDER_CANCELLATION: 'PEDIDO CANCELADO',
    CASHIER_RECEIPT: 'COMPROVANTE DO CAIXA',
    DISPATCH_ORDER: 'EXPEDICAO',
    CUSTOMER_RECEIPT: 'VIA DO CLIENTE',
    TEST_PAGE: 'PAGINA DE TESTE',
    REPRINT: 'REIMPRESSAO',
  }
  const blocks: EscPosBlock[] = []
  if (snapshot.marker === 'REIMPRESSAO') {
    blocks.push({ text: '*** REIMPRESSAO ***', align: 'center', bold: true, width: 2 })
  }
  blocks.push(
    {
      text: eventLabel[snapshot.documentType] ?? snapshot.documentType,
      align: 'center',
      bold: true,
      width: 2,
    },
    {
      text: snapshot.order.number === 'TESTE' ? 'TESTE' : `PEDIDO #${snapshot.order.number}`,
      align: 'center',
      bold: true,
      height: 2,
    },
    { text: separator(columns) },
    { text: formatDate(snapshot.order.createdAt) },
    { text: serviceLabel(snapshot.order.serviceType, snapshot.order.tableCode) },
  )
  if (snapshot.order.priority !== 'normal') {
    blocks.push({ text: `PRIORIDADE: ${snapshot.order.priority.toUpperCase()}`, bold: true })
  }
  blocks.push({ text: separator(columns) })
  if (snapshot.jobId !== jobId) blocks.push({ text: 'SNAPSHOT INCONSISTENTE', bold: true })
  return blocks
}

function productionBlocks(snapshot: Snapshot, columns: number): EscPosBlock[] {
  const blocks: EscPosBlock[] = []
  for (const item of snapshot.items) {
    blocks.push({ text: `${formatQuantity(item.quantity)}x ${item.name}`, bold: true })
    for (const option of item.options) {
      blocks.push({ text: `  + ${formatQuantity(option.quantity)}x ${option.name}` })
    }
    if (item.notes) blocks.push({ text: `  OBS: ${item.notes}`, bold: true })
  }
  if (snapshot.order.notes) blocks.push({ text: `OBS GERAL: ${snapshot.order.notes}`, bold: true })
  blocks.push({ text: separator(columns) })
  return blocks
}

function receiptBlocks(snapshot: Snapshot, columns: number, customerCopy: boolean): EscPosBlock[] {
  if (!snapshot.financial) {
    throw new TemplateValidationError('Financial snapshot is required for receipt.')
  }
  const blocks: EscPosBlock[] = customerCopy
    ? [{ text: 'VIA DO CLIENTE', align: 'center', bold: true }]
    : []
  for (const item of snapshot.items) {
    blocks.push({
      text: formatColumns(
        `${formatQuantity(item.quantity)}x ${item.name}`,
        money(item.totalPrice ?? (item.unitPrice ?? 0) * item.quantity),
        columns,
      ),
    })
    for (const option of item.options) blocks.push({ text: `  + ${option.name}` })
  }
  blocks.push(
    { text: separator(columns) },
    { text: formatColumns('Subtotal', money(snapshot.financial.subtotal), columns) },
    { text: formatColumns('Taxa', money(snapshot.financial.deliveryFee), columns) },
    { text: formatColumns('Desconto', money(snapshot.financial.discount), columns) },
    {
      text: formatColumns('TOTAL', money(snapshot.financial.total), columns),
      bold: true,
      height: 2,
    },
    { text: `Pagamento: ${snapshot.financial.paymentMethod}` },
    { text: `Status: ${snapshot.financial.paymentStatus}` },
    { text: separator(columns) },
  )
  return blocks
}

function dispatchBlocks(snapshot: Snapshot, columns: number): EscPosBlock[] {
  if (!snapshot.dispatch) {
    throw new TemplateValidationError('Dispatch snapshot is required.')
  }
  return [
    { text: snapshot.dispatch.customerName, bold: true },
    ...(snapshot.dispatch.maskedPhone ? [{ text: `Telefone: ${snapshot.dispatch.maskedPhone}` }] : []),
    ...(snapshot.dispatch.address ? [{ text: `Endereco: ${snapshot.dispatch.address}` }] : []),
    ...(snapshot.dispatch.addressReference
      ? [{ text: `Referencia: ${snapshot.dispatch.addressReference}` }]
      : []),
    { text: `Pagamento: ${snapshot.dispatch.paymentMethod}` },
    {
      text: `A receber: ${money(snapshot.dispatch.amountToCollect)}`,
      bold: snapshot.dispatch.amountToCollect > 0,
    },
    ...(snapshot.dispatch.driverName ? [{ text: `Entregador: ${snapshot.dispatch.driverName}` }] : []),
    { text: separator(columns) },
  ]
}

function testBlocks(job: ClaimedPrintJob, columns: number): EscPosBlock[] {
  return [
    { text: 'Cain Print Agent', align: 'center', bold: true },
    { text: `Impressora: ${job.printer.name}` },
    { text: `Papel: ${job.printer.paperWidth} mm` },
    { text: `Encoding: ${job.printer.encoding}` },
    { text: 'Acentos: acao, cafe, pao, acucar, coracao, maca, limao' },
    { text: 'PT-BR: acao / café / pão / açúcar / coração / maçã / limão' },
    { text: separator(columns) },
  ]
}

function parseSnapshot(value: unknown, jobId: string): Snapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TemplateValidationError('Snapshot must be an object.')
  }
  const snapshot = value as Partial<Snapshot>
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.jobId !== jobId ||
    !snapshot.order ||
    !snapshot.station ||
    !Array.isArray(snapshot.items) ||
    !snapshot.documentType ||
    !['ORIGINAL', 'REIMPRESSAO'].includes(snapshot.marker ?? '')
  ) {
    throw new TemplateValidationError('Snapshot schema is invalid.')
  }
  return snapshot as Snapshot
}

function separator(columns: number) {
  return '-'.repeat(columns)
}

function shortJobId(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Horario indisponivel'
    : date.toLocaleString('pt-BR', { timeZone: 'America/Manaus', hour12: false })
}

function serviceLabel(serviceType: string, tableCode: string | null) {
  if (tableCode) return tableCode
  const labels: Record<string, string> = {
    delivery: 'Delivery',
    pickup: 'Retirada',
    counter: 'Balcao',
    dine_in: 'Salao',
    digital_menu: 'Cardapio digital',
    whatsapp: 'WhatsApp',
    test: 'Teste local',
  }
  return labels[serviceType] ?? serviceType
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function money(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}
