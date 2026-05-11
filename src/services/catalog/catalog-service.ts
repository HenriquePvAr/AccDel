import type {
  ListCategoriesResponse,
  ListCouponsResponse,
  ListProductsResponse,
  ListPromotionsResponse,
  ProductsListFilters,
  SaveProductRequest,
  SaveProductResponse,
  ToggleProductSoldOutRequest,
  ToggleProductSoldOutResponse,
  UpdateProductChannelAvailabilityRequest,
  UpdateProductChannelAvailabilityResponse,
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

  async listProducts(filters?: ProductsListFilters): Promise<ListProductsResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListProductsResponse>(
        `/catalog/products${buildQueryString(filters ?? {})}`,
      )
    }

    return simulateAsync(buildProductsResponse(getDemoDatabase().catalog.products, filters))
  },

  async listPromotions(): Promise<ListPromotionsResponse> {
    return simulateAsync(buildPromotionsResponse(getDemoDatabase().catalog.promotions))
  },

  async listCoupons(): Promise<ListCouponsResponse> {
    return simulateAsync(buildCouponsResponse(getDemoDatabase().catalog.coupons))
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
