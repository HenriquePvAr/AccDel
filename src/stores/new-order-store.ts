import { createAppJSONStorage } from '@/lib/storage'
import type { OrderChannel, OrderItem, OrderItemOption, PaymentMethod } from '@/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NewOrderState {
  channel: OrderChannel
  customerId: string | null
  addressId: string | null
  tableId: string | null
  tableSessionId: string | null
  paymentMethod: PaymentMethod
  notes: string
  sendToProduction: boolean
  sourceAiOrderDraftId: string | null
  draftSavedAt: string | null
  cartItems: OrderItem[]
  setChannel: (value: OrderChannel) => void
  setCustomerId: (value: string | null) => void
  setAddressId: (value: string | null) => void
  setTableId: (value: string | null) => void
  setTableSessionId: (value: string | null) => void
  setPaymentMethod: (value: PaymentMethod) => void
  setNotes: (value: string) => void
  setSendToProduction: (value: boolean) => void
  setSourceAiOrderDraftId: (value: string | null) => void
  saveDraft: () => void
  replaceCartItems: (items: OrderItem[]) => void
  toggleSendToProduction: () => void
  addProduct: (productId: string, name: string, price: number) => void
  addConfiguredProduct: (
    productId: string,
    name: string,
    price: number,
    options: OrderItemOption[],
    notes?: string,
  ) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  updateItemNotes: (itemId: string, notes: string) => void
  reset: () => void
}

const defaults = {
  channel: 'delivery' as OrderChannel,
  customerId: null,
  addressId: null,
  tableId: null,
  tableSessionId: null,
  paymentMethod: 'pix' as PaymentMethod,
  notes: '',
  sendToProduction: true,
  sourceAiOrderDraftId: null,
  draftSavedAt: null,
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
      setTableSessionId: (value) => set({ tableSessionId: value }),
      setPaymentMethod: (value) => set({ paymentMethod: value }),
      setNotes: (value) => set({ notes: value }),
      setSendToProduction: (value) => set({ sendToProduction: value }),
      setSourceAiOrderDraftId: (value) => set({ sourceAiOrderDraftId: value }),
      saveDraft: () => set({ draftSavedAt: new Date().toISOString() }),
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
      addConfiguredProduct: (productId, name, price, options, notes) =>
        set((state) => {
          const existing = state.cartItems.find(
            (item) =>
              item.productId === productId &&
              buildOptionSignature(item.options) === buildOptionSignature(options) &&
              (item.notes ?? '') === (notes ?? ''),
          )

          if (existing) {
            return {
              cartItems: state.cartItems.map((item) =>
                item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
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
                notes,
                options,
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
      updateItemNotes: (itemId, notes) =>
        set((state) => ({
          cartItems: state.cartItems.map((item) =>
            item.id === itemId ? { ...item, notes } : item,
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

function buildOptionSignature(options: OrderItemOption[]) {
  return options
    .map((option) => `${option.groupId ?? 'group'}:${option.id}:${option.quantity}`)
    .sort()
    .join('|')
}
