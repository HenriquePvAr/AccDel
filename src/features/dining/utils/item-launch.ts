import type { TableSessionItem } from '@/types'

export function formatItemLaunchTime(value?: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  return new Intl.DateTimeFormat('pt-BR', {
    ...(sameDay ? {} : { day: '2-digit', month: '2-digit' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatItemResponsible(item: Pick<TableSessionItem, 'createdByName'>) {
  return item.createdByName?.trim() || 'Responsável não registrado'
}

export function formatItemLaunchMeta(item: Pick<TableSessionItem, 'createdAt' | 'createdByName'>) {
  const time = formatItemLaunchTime(item.createdAt)
  const responsible = formatItemResponsible(item)

  return time ? `${time} · ${responsible}` : responsible
}
