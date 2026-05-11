import { categoriesMock, couponsMock, productsMock, promotionsMock } from '@/mocks'
import type { Product, ProductChannel } from '@/types'
import { create } from 'zustand'

interface CatalogState {
  categories: typeof categoriesMock
  products: Product[]
  promotions: typeof promotionsMock
  coupons: typeof couponsMock
  toggleSoldOut: (productId: string, channel: ProductChannel) => void
  saveProduct: (product: Product) => void
}

export const useCatalogStore = create<CatalogState>((set) => ({
  categories: structuredClone(categoriesMock),
  products: structuredClone(productsMock),
  promotions: structuredClone(promotionsMock),
  coupons: structuredClone(couponsMock),
  toggleSoldOut: (productId, channel) =>
    set((state) => ({
      products: state.products.map((product) =>
        product.id === productId
          ? {
              ...product,
              availability: product.availability.map((entry) =>
                entry.channel === channel ? { ...entry, soldOut: !entry.soldOut } : entry,
              ),
            }
          : product,
      ),
    })),
  saveProduct: (product) =>
    set((state) => {
      const exists = state.products.some((entry) => entry.id === product.id)

      return {
        products: exists
          ? state.products.map((entry) => (entry.id === product.id ? product : entry))
          : [product, ...state.products],
      }
    }),
}))
