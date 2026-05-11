import type { Category, Coupon, Product, ProductChannel, Promotion } from '@/types'

import type { ListResponse, PaginationParams } from '@/contracts/common'

export interface ProductsListFilters extends PaginationParams {
  search?: string
  categoryId?: string | 'all'
  status?: 'all' | 'active' | 'inactive'
  channel?: ProductChannel | 'all'
}

export type ListCategoriesResponse = ListResponse<Category>
export type ListProductsResponse = ListResponse<Product>
export type ListPromotionsResponse = ListResponse<Promotion>
export type ListCouponsResponse = ListResponse<Coupon>

export interface SaveProductRequest {
  product: Product
}

export interface SaveProductResponse {
  data: Product
}

export interface ToggleProductSoldOutRequest {
  productId: string
  channel: ProductChannel
}

export interface ToggleProductSoldOutResponse {
  data: Product
}

export interface UpdateProductChannelAvailabilityRequest {
  productId: string
  channel: ProductChannel
  available?: boolean
  visible?: boolean
  soldOut?: boolean
}

export interface UpdateProductChannelAvailabilityResponse {
  data: Product
}
