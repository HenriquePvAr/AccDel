import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ProductsListFilters, UpdateProductChannelAvailabilityRequest } from '@/contracts'
import { catalogService } from '@/services'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useToastStore } from '@/stores/toast-store'
import type { ProductChannel } from '@/types'

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.catalog.categories,
    queryFn: () => catalogService.listCategories(),
  })
}

export function useProductsQuery(filters?: ProductsListFilters) {
  return useQuery({
    queryKey: queryKeys.catalog.products(filters ?? {}),
    queryFn: () => catalogService.listProducts(filters),
  })
}

export function usePromotionsQuery() {
  return useQuery({
    queryKey: queryKeys.catalog.promotions,
    queryFn: () => catalogService.listPromotions(),
  })
}

export function useCouponsQuery() {
  return useQuery({
    queryKey: queryKeys.catalog.coupons,
    queryFn: () => catalogService.listCoupons(),
  })
}

export function useToggleProductSoldOutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      productId,
      channel,
    }: {
      productId: string
      channel: ProductChannel
    }) => catalogService.toggleProductSoldOut({ productId, channel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Disponibilidade atualizada',
        description: 'O produto já refletiu no catálogo persistido.',
        variant: 'success',
      })
    },
  })
}

export function useSaveProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (product: import('@/types').Product) =>
      catalogService.saveProduct({ product }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Produto salvo',
        description: 'As alterações do produto já estão persistidas no mock local.',
        variant: 'success',
      })
    },
  })
}

export function useUpdateProductChannelMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateProductChannelAvailabilityRequest) =>
      catalogService.updateProductChannelAvailability(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Canal atualizado',
        description: 'A disponibilidade por canal foi persistida localmente.',
        variant: 'success',
      })
    },
  })
}
