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
    label: 'Novos',
    shortLabel: 'NOVOS',
    textClass: 'text-sky-700',
    badgeClass: 'bg-sky-50 text-sky-800 ring-sky-200',
    borderClass: 'border-l-sky-600',
    icon: ClipboardList,
  },
  in_preparation: {
    label: 'Em preparo',
    shortLabel: 'EM PREPARO',
    textClass: 'text-amber-800',
    badgeClass: 'bg-amber-50 text-amber-900 ring-amber-200',
    borderClass: 'border-l-amber-600',
    icon: Clock3,
  },
  ready: {
    label: 'Prontos',
    shortLabel: 'PRONTOS',
    textClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    borderClass: 'border-l-emerald-600',
    icon: CheckCircle2,
  },
  out_for_delivery: {
    label: 'Em rota',
    shortLabel: 'EM ROTA',
    textClass: 'text-blue-700',
    badgeClass: 'bg-blue-50 text-blue-800 ring-blue-200',
    borderClass: 'border-l-blue-600',
    icon: Bike,
  },
  completed: {
    label: 'Finalizado',
    shortLabel: 'FINALIZADO',
    textClass: 'text-slate-700',
    badgeClass: 'bg-slate-100 text-slate-800 ring-slate-200',
    borderClass: 'border-l-slate-500',
    icon: CircleDot,
  },
  cancelled: {
    label: 'Cancelado',
    shortLabel: 'CANCELADO',
    textClass: 'text-red-700',
    badgeClass: 'bg-red-50 text-red-800 ring-red-200',
    borderClass: 'border-l-red-600',
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
      return { action: 'accept', label: 'Aceitar', tone: 'blue' }
    case 'in_preparation':
      return { action: 'ready', label: 'Marcar pronto', tone: 'orange' }
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
