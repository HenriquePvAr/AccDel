import {
  Bike,
  CheckCircle2,
  CircleDot,
  Clock3,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'

import type { Order, OrderStatus } from '@/types'

import type { OrderAction } from './order-actions'

export interface OrderStatusUi {
  label: string
  shortLabel: string
  textClass: string
  badgeClass: string
  borderClass: string
  icon: LucideIcon
}

export const orderStatusUi: Record<OrderStatus, OrderStatusUi> = {
  in_analysis: {
    label: 'Em analise',
    shortLabel: 'NOVO',
    textClass: 'text-sky-300',
    badgeClass: 'bg-sky-500/15 text-sky-300 ring-sky-400/20',
    borderClass: 'border-l-sky-400',
    icon: ClipboardList,
  },
  in_preparation: {
    label: 'Em preparo',
    shortLabel: 'EM PREPARO',
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-400/15 text-amber-300 ring-amber-300/20',
    borderClass: 'border-l-amber-400',
    icon: Clock3,
  },
  ready: {
    label: 'Pronto',
    shortLabel: 'PRONTO',
    textClass: 'text-emerald-300',
    badgeClass: 'bg-emerald-400/15 text-emerald-300 ring-emerald-300/20',
    borderClass: 'border-l-emerald-400',
    icon: CheckCircle2,
  },
  out_for_delivery: {
    label: 'Em rota',
    shortLabel: 'EM ROTA',
    textClass: 'text-blue-300',
    badgeClass: 'bg-blue-500/15 text-blue-300 ring-blue-400/20',
    borderClass: 'border-l-blue-400',
    icon: Bike,
  },
  completed: {
    label: 'Finalizado',
    shortLabel: 'FINALIZADO',
    textClass: 'text-slate-300',
    badgeClass: 'bg-slate-500/15 text-slate-300 ring-slate-400/20',
    borderClass: 'border-l-slate-500',
    icon: CircleDot,
  },
  cancelled: {
    label: 'Cancelado',
    shortLabel: 'CANCELADO',
    textClass: 'text-red-300',
    badgeClass: 'bg-red-500/15 text-red-300 ring-red-400/20',
    borderClass: 'border-l-red-400',
    icon: CircleDot,
  },
}

export function getPrimaryOrderAction(order: Order): {
  action?: OrderAction
  label: string
  tone: 'orange' | 'green' | 'blue' | 'neutral'
} {
  switch (order.status) {
    case 'in_analysis':
      return { action: 'accept', label: 'Aceitar', tone: 'orange' }
    case 'in_preparation':
      return { action: 'ready', label: 'Marcar como pronto', tone: 'orange' }
    case 'ready':
      return order.source === 'delivery'
        ? { action: 'dispatch', label: 'Despachar', tone: 'green' }
        : { action: 'complete', label: 'Finalizar', tone: 'green' }
    case 'out_for_delivery':
      return { label: 'Acompanhar', tone: 'blue' }
    case 'completed':
    case 'cancelled':
      return { label: 'Ver detalhes', tone: 'neutral' }
  }
}

export function formatElapsedShort(value: string) {
  const elapsedMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(elapsedMs / 60000))

  if (minutes < 60) {
    return `${minutes} min atras`
  }

  const hours = Math.floor(minutes / 60)
  return `${hours}h atras`
}

export function getOrderItemCountLabel(order: Order) {
  const count = order.items.reduce((total, item) => total + item.quantity, 0)
  return `${count} ${count === 1 ? 'item' : 'itens'}`
}
