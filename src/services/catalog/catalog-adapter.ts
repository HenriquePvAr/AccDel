import type {
  ListCategoriesResponse,
  ListCouponsResponse,
  ListProductsResponse,
  ListPromotionsResponse,
  ProductsListFilters,
  UpdateProductChannelAvailabilityRequest,
} from '@/contracts'
import { buildListResponse } from '@/services/adapters/list-response'
import type { Category, Coupon, Product, Promotion } from '@/types'

export function buildProductsResponse(
  products: Product[],
  filters?: ProductsListFilters,
): ListProductsResponse {
  const search = filters?.search?.trim().toLowerCase()
  const rows = products.filter((product) => {
    const matchesSearch =
      !search ||
      `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(search)
    const matchesCategory =
      !filters?.categoryId ||
      filters.categoryId === 'all' ||
      product.categoryId === filters.categoryId
    const matchesStatus =
      !filters?.status ||
      filters.status === 'all' ||
      (filters.status === 'active' ? product.active : !product.active)
    const matchesChannel =
      !filters?.channel ||
      filters.channel === 'all' ||
      product.availability.some(
        (entry) => entry.channel === filters.channel && entry.visible,
      )

    return matchesSearch && matchesCategory && matchesStatus && matchesChannel
  })

  return buildListResponse(rows, filters)
}

export function buildCategoriesResponse(categories: Category[]): ListCategoriesResponse {
  return buildListResponse(categories)
}

export function buildPromotionsResponse(promotions: Promotion[]): ListPromotionsResponse {
  return buildListResponse(promotions)
}

export function buildCouponsResponse(coupons: Coupon[]): ListCouponsResponse {
  return buildListResponse(coupons)
}

export function applyChannelAvailabilityUpdate(
  product: Product,
  request: UpdateProductChannelAvailabilityRequest,
) {
  return {
    ...product,
    availability: product.availability.map((entry) =>
      entry.channel === request.channel
        ? {
            ...entry,
            available: request.available ?? entry.available,
            visible: request.visible ?? entry.visible,
            soldOut: request.soldOut ?? entry.soldOut,
          }
        : entry,
    ),
  }
}
