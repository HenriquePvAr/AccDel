import { createAppJSONStorage } from '@/lib/storage'
import type { OrderChannel, OrderItem, PaymentMethod } from '@/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NewOrderState {
  channel: OrderChannel
  customerId: string | null
  addressId: string | null
  tableId: string | null
  paymentMethod: PaymentMethod
  notes: string
  sendToProduction: boolean
  cartItems: OrderItem[]
  setChannel: (value: OrderChannel) => void
  setCustomerId: (value: string | null) => void
  setAddressId: (value: string | null) => void
  setTableId: (value: string | null) => void
  setPaymentMethod: (value: PaymentMethod) => void
  setNotes: (value: string) => void
  setSendToProduction: (value: boolean) => void
  replaceCartItems: (items: OrderItem[]) => void
  toggleSendToProduction: () => void
  addProduct: (productId: string, name: string, price: number) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  reset: () => void
}

const defaults = {
  channel: 'delivery' as OrderChannel,
  customerId: 'cus_1',
  addressId: 'addr_1',
  tableId: null,
  paymentMethod: 'pix' as PaymentMethod,
  notes: '',
  sendToProduction: true,
  cartItems: [] as OrderItem[],
}

export const useNewOrderStore = create<NewOrderState>()(
  persist(
    (set) => ({
      ...defaults,
      setChannel: (value) => set({ channel: value }),
      setCustomerId: (value) => set({ customerId: value }),
      setAddressId: (value) => set({ addressId: value }),
      setTableId: (value) => set({ tableId: value }),
      setPaymentMethod: (value) => set({ paymentMethod: value }),
      setNotes: (value) => set({ notes: value }),
      setSendToProduction: (value) => set({ sendToProduction: value }),
      replaceCartItems: (items) => set({ cartItems: items }),
      toggleSendToProduction: () =>
        set((state) => ({ sendToProduction: !state.sendToProduction })),
      addProduct: (productId, name, price) =>
        set((state) => {
          const existing = state.cartItems.find((item) => item.productId === productId)

          if (existing) {
            return {
              cartItems: state.cartItems.map((item) =>
                item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
              ),
            }
          }

          return {
            cartItems: [
              ...state.cartItems,
              {
                id: crypto.randomUUID(),
                productId,
                name,
                quantity: 1,
                unitPrice: price,
                options: [],
              },
            ],
          }
        }),
      removeItem: (itemId) =>
        set((state) => ({ cartItems: state.cartItems.filter((item) => item.id !== itemId) })),
      updateQuantity: (itemId, quantity) =>
        set((state) => ({
          cartItems: state.cartItems.map((item) =>
            item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item,
          ),
        })),
      reset: () => set(defaults),
    }),
    {
      name: 'cain-admin-new-order',
      storage: createAppJSONStorage(),
    },
  ),
)
