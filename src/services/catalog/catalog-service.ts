import type {
  CommercialListFilters,
  DeleteCategoryResponse,
  ListCategoriesResponse,
  ListCouponsResponse,
  ListProductsResponse,
  ListPromotionsResponse,
  ProductsListFilters,
  SaveCategoryRequest,
  SaveCategoryResponse,
  SaveCouponRequest,
  SaveCouponResponse,
  SaveProductRequest,
  SaveProductResponse,
  SavePromotionRequest,
  SavePromotionResponse,
  ToggleCategorySoldOutRequest,
  ToggleCategorySoldOutResponse,
  ToggleProductSoldOutRequest,
  ToggleProductSoldOutResponse,
  UpdateProductChannelAvailabilityRequest,
  UpdateProductChannelAvailabilityResponse,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '@/contracts'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import {
  ApiClientError,
  apiClient,
  buildQueryString,
  shouldUseApi,
} from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { simulateAsync } from '@/services/utils'

import {
  applyChannelAvailabilityUpdate,
  buildCategoriesResponse,
  buildCouponsResponse,
  buildProductsResponse,
  buildPromotionsResponse,
} from './catalog-adapter'

export const catalogService = {
  async listCategories(): Promise<ListCategoriesResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListCategoriesResponse>('/catalog/categories')
    }

    return simulateAsync(buildCategoriesResponse(getDemoDatabase().catalog.categories))
  },

  async saveCategory(request: SaveCategoryRequest): Promise<SaveCategoryResponse> {
    if (shouldUseApi) {
      if (request.category.id) {
        return apiClient.patch<SaveCategoryResponse, SaveCategoryRequest>(
          `/catalog/categories/${request.category.id}`,
          request,
        )
      }

      return apiClient.post<SaveCategoryResponse, SaveCategoryRequest>(
        '/catalog/categories',
        request,
      )
    }

    const nextDb = mutateDemoDatabase((database) => {
      const category = {
        ...request.category,
        id: request.category.id || crypto.randomUUID(),
      }
      const index = database.catalog.categories.findIndex((entry) => entry.id === category.id)
      if (index >= 0) {
        database.catalog.categories[index] = category
      } else {
        database.catalog.categories.push(category)
      }
      return database
    })
    const saved =
      nextDb.catalog.categories.find((entry) => entry.id === request.category.id) ??
      nextDb.catalog.categories.at(-1)!

    return simulateAsync({ data: saved })
  },

  async deleteCategory(categoryId: string): Promise<DeleteCategoryResponse> {
    if (shouldUseApi) {
      return apiClient.delete<DeleteCategoryResponse>(`/catalog/categories/${categoryId}`)
    }

    const nextDb = mutateDemoDatabase((database) => {
      const hasProducts = database.catalog.products.some((product) => product.categoryId === categoryId)
      database.catalog.categories = hasProducts
        ? database.catalog.categories.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  active: false,
                  visibleOnPos: false,
                  visibleOnDigitalMenu: false,
                }
              : category,
          )
        : database.catalog.categories.filter((category) => category.id !== categoryId)
      return database
    })
    const category = nextDb.catalog.categories.find((entry) => entry.id === categoryId) ?? null

    return simulateAsync({ data: category, deleted: category === null })
  },

  async toggleCategorySoldOut(
    request: ToggleCategorySoldOutRequest,
  ): Promise<ToggleCategorySoldOutResponse> {
    if (shouldUseApi) {
      return apiClient.patch<
        ToggleCategorySoldOutResponse,
        Omit<ToggleCategorySoldOutRequest, 'categoryId'>
      >(`/catalog/categories/${request.categoryId}/sold-out`, {
        channels: request.channels,
        soldOut: request.soldOut,
      })
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.catalog.products = database.catalog.products.map((product) =>
        product.categoryId === request.categoryId
          ? {
              ...product,
              availability: product.availability.map((entry) =>
                request.channels.includes(entry.channel)
                  ? {
                      ...entry,
                      visible: true,
                      available: true,
                      soldOut: request.soldOut,
                    }
                  : entry,
              ),
            }
          : product,
      )
      return database
    })
    const affected = nextDb.catalog.products.filter(
      (product) => product.categoryId === request.categoryId,
    ).length

    return simulateAsync({
      data: {
        categoryId: request.categoryId,
        affected,
        soldOut: request.soldOut,
        channels: request.channels,
      },
    })
  },

  async listProducts(filters?: ProductsListFilters): Promise<ListProductsResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListProductsResponse>(
        `/catalog/products${buildQueryString(filters ?? {})}`,
      )
    }

    return simulateAsync(buildProductsResponse(getDemoDatabase().catalog.products, filters))
  },

  async listPromotions(filters?: CommercialListFilters): Promise<ListPromotionsResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListPromotionsResponse>(
        `/catalog/promotions${buildQueryString(filters ?? {})}`,
      )
    }

    return simulateAsync(buildPromotionsResponse(getDemoDatabase().catalog.promotions))
  },

  async savePromotion(request: SavePromotionRequest): Promise<SavePromotionResponse> {
    if (shouldUseApi) {
      if (request.promotion.id) {
        return apiClient.patch<SavePromotionResponse, SavePromotionRequest>(
          `/catalog/promotions/${request.promotion.id}`,
          request,
        )
      }

      return apiClient.post<SavePromotionResponse, SavePromotionRequest>(
        '/catalog/promotions',
        request,
      )
    }

    const nextDb = mutateDemoDatabase((database) => {
      const promotion = {
        ...request.promotion,
        id: request.promotion.id || crypto.randomUUID(),
      }
      const index = database.catalog.promotions.findIndex((entry) => entry.id === promotion.id)
      if (index >= 0) {
        database.catalog.promotions[index] = promotion
      } else {
        database.catalog.promotions.unshift(promotion)
      }
      return database
    })
    const saved =
      nextDb.catalog.promotions.find((entry) => entry.id === request.promotion.id) ??
      nextDb.catalog.promotions[0]

    return simulateAsync({ data: saved })
  },

  async deletePromotion(promotionId: string): Promise<SavePromotionResponse> {
    if (shouldUseApi) {
      return apiClient.delete<SavePromotionResponse>(`/catalog/promotions/${promotionId}`)
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.catalog.promotions = database.catalog.promotions.map((promotion) =>
        promotion.id === promotionId ? { ...promotion, status: 'inactive' } : promotion,
      )
      return database
    })
    const saved = nextDb.catalog.promotions.find((entry) => entry.id === promotionId)!

    return simulateAsync({ data: saved })
  },

  async listCoupons(filters?: CommercialListFilters): Promise<ListCouponsResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListCouponsResponse>(
        `/catalog/coupons${buildQueryString(filters ?? {})}`,
      )
    }

    return simulateAsync(buildCouponsResponse(getDemoDatabase().catalog.coupons))
  },

  async saveCoupon(request: SaveCouponRequest): Promise<SaveCouponResponse> {
    if (shouldUseApi) {
      if (request.coupon.id) {
        return apiClient.patch<SaveCouponResponse, SaveCouponRequest>(
          `/catalog/coupons/${request.coupon.id}`,
          request,
        )
      }

      return apiClient.post<SaveCouponResponse, SaveCouponRequest>('/catalog/coupons', request)
    }

    const nextDb = mutateDemoDatabase((database) => {
      const coupon = {
        ...request.coupon,
        id: request.coupon.id || crypto.randomUUID(),
      }
      const index = database.catalog.coupons.findIndex((entry) => entry.id === coupon.id)
      if (index >= 0) {
        database.catalog.coupons[index] = coupon
      } else {
        database.catalog.coupons.unshift(coupon)
      }
      return database
    })
    const saved =
      nextDb.catalog.coupons.find((entry) => entry.id === request.coupon.id) ??
      nextDb.catalog.coupons[0]

    return simulateAsync({ data: saved })
  },

  async validateCoupon(request: ValidateCouponRequest): Promise<ValidateCouponResponse> {
    if (shouldUseApi) {
      return apiClient.post<ValidateCouponResponse, ValidateCouponRequest>(
        '/catalog/coupons/validate',
        request,
      )
    }

    const coupon = getDemoDatabase().catalog.coupons.find(
      (entry) => entry.code.toUpperCase() === request.code.trim().toUpperCase(),
    )
    if (!coupon || coupon.status !== 'active') {
      return simulateAsync({ data: { valid: false, reason: 'Cupom nao encontrado ou inativo.' } })
    }

    const discount =
      coupon.type === 'percent'
        ? Math.min(request.orderTotal, (request.orderTotal * coupon.value) / 100)
        : Math.min(request.orderTotal, coupon.value)

    return simulateAsync({ data: { valid: true, coupon, discount } })
  },

  async deleteCoupon(couponId: string): Promise<SaveCouponResponse> {
    if (shouldUseApi) {
      return apiClient.delete<SaveCouponResponse>(`/catalog/coupons/${couponId}`)
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.catalog.coupons = database.catalog.coupons.map((coupon) =>
        coupon.id === couponId ? { ...coupon, status: 'inactive' } : coupon,
      )
      return database
    })
    const saved = nextDb.catalog.coupons.find((entry) => entry.id === couponId)!

    return simulateAsync({ data: saved })
  },

  async saveProduct(request: SaveProductRequest): Promise<SaveProductResponse> {
    if (shouldUseApi) {
      try {
        const response = await apiClient.patch<SaveProductResponse, SaveProductRequest>(
          `/catalog/products/${request.product.id}`,
          request,
        )
        mockRealtimeBus.emit('catalog.product_updated', { productId: response.data.id })
        return response
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 404) {
          throw error
        }

        const response = await apiClient.post<SaveProductResponse, SaveProductRequest>(
          '/catalog/products',
          request,
        )
        mockRealtimeBus.emit('catalog.product_updated', { productId: response.data.id })
        return response
      }
    }

    const nextDb = mutateDemoDatabase((database) => {
      const index = database.catalog.products.findIndex((entry) => entry.id === request.product.id)
      if (index >= 0) {
        database.catalog.products[index] = request.product
      } else {
        database.catalog.products.unshift({ ...request.product, id: crypto.randomUUID() })
      }
      return database
    })

    const saved =
      nextDb.catalog.products.find((entry) => entry.id === request.product.id) ??
      nextDb.catalog.products[0]

    mockRealtimeBus.emit('catalog.product_updated', { productId: saved.id })
    return simulateAsync({ data: saved })
  },

  async toggleProductSoldOut(
    request: ToggleProductSoldOutRequest,
  ): Promise<ToggleProductSoldOutResponse> {
    if (shouldUseApi) {
      const response = await apiClient.patch<
        ToggleProductSoldOutResponse,
        Pick<ToggleProductSoldOutRequest, 'channel'>
      >(`/catalog/products/${request.productId}/sold-out`, {
        channel: request.channel,
      })
      mockRealtimeBus.emit('catalog.product_updated', { productId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.catalog.products = database.catalog.products.map((product) =>
        product.id === request.productId
          ? applyChannelAvailabilityUpdate(product, {
              productId: request.productId,
              channel: request.channel,
              soldOut: !product.availability.find((entry) => entry.channel === request.channel)?.soldOut,
            })
          : product,
      )
      return database
    })

    const updated = nextDb.catalog.products.find((product) => product.id === request.productId)!
    mockRealtimeBus.emit('catalog.product_updated', { productId: updated.id })
    return simulateAsync({ data: updated })
  },

  async updateProductChannelAvailability(
    request: UpdateProductChannelAvailabilityRequest,
  ): Promise<UpdateProductChannelAvailabilityResponse> {
    if (shouldUseApi) {
      const response = await apiClient.patch<
        UpdateProductChannelAvailabilityResponse,
        Omit<UpdateProductChannelAvailabilityRequest, 'productId'>
      >(`/catalog/products/${request.productId}/channels`, {
        channel: request.channel,
        available: request.available,
        visible: request.visible,
        soldOut: request.soldOut,
      })
      mockRealtimeBus.emit('catalog.product_updated', { productId: response.data.id })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.catalog.products = database.catalog.products.map((product) =>
        product.id === request.productId
          ? applyChannelAvailabilityUpdate(product, request)
          : product,
      )
      return database
    })

    const updated = nextDb.catalog.products.find((product) => product.id === request.productId)!
    mockRealtimeBus.emit('catalog.product_updated', { productId: updated.id })
    return simulateAsync({ data: updated })
  },
}
