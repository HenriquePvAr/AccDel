import { format, formatDistanceToNowStrict } from 'date-fns'

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDateTime(value: string) {
  return format(new Date(value), 'dd/MM HH:mm')
}

export function formatDateFull(value: string) {
  return format(new Date(value), 'dd/MM/yyyy HH:mm')
}

export function formatRelative(value: string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true })
}

export function formatPercent(value: number) {
  return `${value.toFixed(0)}%`
}
