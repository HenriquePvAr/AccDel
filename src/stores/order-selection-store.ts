import { create } from 'zustand'

interface OrderSelectionState {
  selectedOrderId: string | null
  setSelectedOrderId: (orderId: string | null) => void
}

export const useOrderSelectionStore = create<OrderSelectionState>((set) => ({
  selectedOrderId: null,
  setSelectedOrderId: (orderId) => set({ selectedOrderId: orderId }),
}))
