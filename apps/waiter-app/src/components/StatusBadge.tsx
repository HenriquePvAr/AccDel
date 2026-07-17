import type { PrintStatus, ProductionStatus, TableStatus } from '@/types'

const tableLabels: Record<TableStatus, string> = {
  free: 'Livre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  closing: 'Fechamento',
  closed: 'Fechada',
}

const productionLabels: Record<ProductionStatus, string> = {
  in_analysis: 'Recebido',
  in_preparation: 'Em preparo',
  ready: 'Pronto',
  completed: 'Entregue',
  cancelled: 'Cancelado',
}

const printLabels: Record<PrintStatus, string> = {
  not_required: 'Sem impressão',
  pending: 'Impressão pendente',
  confirmed: 'Impresso',
  failed: 'Falha ao imprimir',
  unknown: 'Impressão incerta',
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  return <span className={`status-badge table-${status}`}>{tableLabels[status]}</span>
}

export function ProductionStatusBadge({ status }: { status?: ProductionStatus }) {
  if (!status) return <span className="status-badge neutral">Rascunho</span>
  return <span className={`status-badge production-${status}`}>{productionLabels[status]}</span>
}

export function PrintStatusBadge({ status }: { status: PrintStatus }) {
  return <span className={`print-label print-${status}`}>{printLabels[status]}</span>
}
