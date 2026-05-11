import { createAppJSONStorage } from '@/lib/storage'
import type { OrderChannel, OrderStatus, PaymentMethod } from '@/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OrderFiltersState {
  search: string
  source: OrderChannel | 'all'
  status: OrderStatus | 'all'
  paymentMethod: PaymentMethod | 'all'
  delayedOnly: boolean
  setSearch: (value: string) => void
  setSource: (value: OrderChannel | 'all') => void
  setStatus: (value: OrderStatus | 'all') => void
  setPaymentMethod: (value: PaymentMethod | 'all') => void
  setDelayedOnly: (value: boolean) => void
  reset: () => void
}

const defaults = {
  search: '',
  source: 'all' as const,
  status: 'all' as const,
  paymentMethod: 'all' as const,
  delayedOnly: false,
}

export const useOrderFiltersStore = create<OrderFiltersState>()(
  persist(
    (set) => ({
      ...defaults,
      setSearch: (value) => set({ search: value }),
      setSource: (value) => set({ source: value }),
      setStatus: (value) => set({ status: value }),
      setPaymentMethod: (value) => set({ paymentMethod: value }),
      setDelayedOnly: (value) => set({ delayedOnly: value }),
      reset: () => set(defaults),
    }),
    {
      name: 'cain-admin-order-filters',
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        search: state.search,
        source: state.source,
        status: state.status,
        paymentMethod: state.paymentMethod,
        delayedOnly: state.delayedOnly,
      }),
    },
  ),
)
