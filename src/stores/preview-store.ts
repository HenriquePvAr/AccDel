import { createAppJSONStorage } from '@/lib/storage'
import { previewCartMock } from '@/mocks'
import type { PreviewCartItem, ProductChannel } from '@/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreviewState {
  channel: ProductChannel
  selectedCategoryId: string | null
  cartItems: PreviewCartItem[]
  setChannel: (value: ProductChannel) => void
  setSelectedCategoryId: (value: string | null) => void
  addCartItem: (item: Omit<PreviewCartItem, 'id' | 'quantity'>) => void
  removeCartItem: (productId: string) => void
  clearCart: () => void
}

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set) => ({
      channel: 'digital_menu',
      selectedCategoryId: 'cat_burgers',
      cartItems: structuredClone(previewCartMock),
      setChannel: (value) => set({ channel: value }),
      setSelectedCategoryId: (value) => set({ selectedCategoryId: value }),
      addCartItem: (item) =>
        set((state) => {
          const existing = state.cartItems.find((entry) => entry.productId === item.productId)

          if (existing) {
            return {
              cartItems: state.cartItems.map((entry) =>
                entry.productId === item.productId
                  ? { ...entry, quantity: entry.quantity + 1 }
                  : entry,
              ),
            }
          }

          return {
            cartItems: [
              ...state.cartItems,
              {
                ...item,
                id: crypto.randomUUID(),
                quantity: 1,
              },
            ],
          }
        }),
      removeCartItem: (productId) =>
        set((state) => ({
          cartItems: state.cartItems.filter((entry) => entry.productId !== productId),
        })),
      clearCart: () => set({ cartItems: [] }),
    }),
    {
      name: 'cain-admin-preview',
      storage: createAppJSONStorage(),
    },
  ),
)
