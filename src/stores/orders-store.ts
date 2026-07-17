import { ordersMock } from '@/mocks'
import type { Order, OrderStatus } from '@/types'
import { create } from 'zustand'

const appendTimeline = (order: Order, label: string, actor: string) => ({
  ...order,
  timeline: [
    ...order.timeline,
    {
      id: crypto.randomUUID(),
      label,
      actor,
      at: new Date().toISOString(),
    },
  ],
})

interface OrdersState {
  orders: Order[]
  acceptOrder: (id: string) => void
  updateStatus: (id: string, status: OrderStatus, actor?: string) => void
  cancelOrder: (id: string) => void
  repeatOrder: (id: string) => void
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: structuredClone(ordersMock),
  acceptOrder: (id) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === id ? appendTimeline(order, 'Pedido aceito', 'Equipe') : order,
      ),
    })),
  updateStatus: (id, status, actor = 'Equipe') =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === id
          ? appendTimeline({ ...order, status }, `Status alterado para ${status}`, actor)
          : order,
      ),
    })),
  cancelOrder: (id) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === id
          ? appendTimeline(
              { ...order, status: 'cancelled', tags: [...order.tags, 'Cancelado'] },
              'Pedido cancelado',
              'Equipe',
            )
          : order,
      ),
    })),
  repeatOrder: (id) =>
    set((state) => {
      const order = state.orders.find((entry) => entry.id === id)

      if (!order) {
        return state
      }

      const nextNumber = `#${1100 + state.orders.length}`

      return {
        orders: [
          {
            ...structuredClone(order),
            id: crypto.randomUUID(),
            number: nextNumber,
            status: 'in_analysis',
            createdAt: new Date().toISOString(),
            dueAt: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
            delayed: false,
            timeline: [
              {
                id: crypto.randomUUID(),
                label: 'Pedido recriado a partir do histórico',
                actor: 'Equipe',
                at: new Date().toISOString(),
              },
            ],
          },
          ...state.orders,
        ],
      }
    }),
}))
