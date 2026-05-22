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

export interface SaveCategoryRequest {
  category: Category
}

export interface SaveCategoryResponse {
  data: Category
}

export interface DeleteCategoryResponse {
  data: Category | null
  deleted: boolean
}

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

export interface ToggleCategorySoldOutRequest {
  categoryId: string
  channels: ProductChannel[]
  soldOut: boolean
}

export interface ToggleCategorySoldOutResponse {
  data: {
    categoryId: string
    affected: number
    soldOut: boolean
    channels: ProductChannel[]
  }
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

export interface CommercialListFilters extends PaginationParams {
  search?: string
  status?: Promotion['status'] | 'all'
}

export interface SavePromotionRequest {
  promotion: Promotion
}

export interface SavePromotionResponse {
  data: Promotion
}

export interface SaveCouponRequest {
  coupon: Coupon
}

export interface SaveCouponResponse {
  data: Coupon
}

export interface ValidateCouponRequest {
  code: string
  orderTotal: number
  channel: ProductChannel
}

export interface ValidateCouponResponse {
  data:
    | {
        valid: true
        discount: number
        coupon: Coupon
      }
    | {
        valid: false
        reason: string
      }
}
