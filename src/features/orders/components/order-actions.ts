import type { Order, OrderStatus } from '@/types'

export type OrderAction =
  | 'accept'
  | 'start_preparation'
  | 'ready'
  | 'dispatch'
  | 'complete'
  | 'cancel'

export interface OrderActionOption {
  key: OrderAction
  label: string
  nextStatus?: OrderStatus
}

export function getOrderActionOptions(order: Order): OrderActionOption[] {
  switch (order.status) {
    case 'in_analysis':
      return [
        { key: 'accept', label: 'Aceitar' },
        { key: 'cancel', label: 'Cancelar', nextStatus: 'cancelled' },
      ]
    case 'in_preparation':
      return [
        { key: 'ready', label: 'Marcar pronto', nextStatus: 'ready' },
        { key: 'cancel', label: 'Cancelar', nextStatus: 'cancelled' },
      ]
    case 'ready':
      return order.source === 'delivery'
        ? [
            { key: 'dispatch', label: 'Despachar', nextStatus: 'out_for_delivery' },
            { key: 'complete', label: 'Finalizar', nextStatus: 'completed' },
          ]
        : [{ key: 'complete', label: 'Finalizar', nextStatus: 'completed' }]
    case 'out_for_delivery':
      return [{ key: 'complete', label: 'Finalizar', nextStatus: 'completed' }]
    default:
      return []
  }
}
