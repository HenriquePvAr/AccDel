import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ApplyOptionGroupToCategoryRequest,
  CatalogMenuSourceFilters,
  ProductsListFilters,
  SaveOptionGroupRequest,
  UpdateOptionAvailabilityRequest,
  UpdateProductChannelAvailabilityRequest,
  UpdateProductOptionGroupLinkRequest,
} from '@/contracts'
import { catalogService } from '@/services'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useToastStore } from '@/stores/toast-store'
import type { Category, Coupon, ProductChannel, Promotion } from '@/types'

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

export function useCatalogMenuSourceQuery(filters: CatalogMenuSourceFilters) {
  return useQuery({
    queryKey: queryKeys.catalog.menuSource(filters),
    queryFn: () => catalogService.getMenuSource(filters),
  })
}

export function useOptionGroupsQuery() {
  return useQuery({
    queryKey: queryKeys.catalog.optionGroups,
    queryFn: () => catalogService.listOptionGroups(),
  })
}

export function useSaveOptionGroupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (group: SaveOptionGroupRequest['group']) =>
      catalogService.saveOptionGroup({ group }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Grupo de opcoes salvo',
        description: `${response.data.name} foi persistido na fonte unica do catalogo.`,
        variant: 'success',
      })
    },
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

export function useSaveCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (category: Category) => catalogService.saveCategory({ category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Categoria salva',
        description: 'A categoria foi persistida no catalogo real.',
        variant: 'success',
      })
    },
  })
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (categoryId: string) => catalogService.deleteCategory(categoryId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: response.deleted ? 'Categoria excluida' : 'Categoria desativada',
        description: response.deleted
          ? 'A categoria nao tinha produtos e foi removida.'
          : 'A categoria tinha produtos vinculados e foi ocultada com seguranca.',
        variant: 'success',
      })
    },
  })
}

export function useToggleCategorySoldOutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      categoryId,
      channels,
      soldOut,
    }: {
      categoryId: string
      channels: ProductChannel[]
      soldOut: boolean
    }) => catalogService.toggleCategorySoldOut({ categoryId, channels, soldOut }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: response.data.soldOut ? 'Categoria marcada como esgotada' : 'Categoria reativada',
        description: `${response.data.affected} produto(s) foram atualizados nos canais selecionados.`,
        variant: 'success',
      })
    },
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
        description: 'As alteracoes do produto foram persistidas pela fonte de dados ativa.',
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
        description: 'A disponibilidade por canal foi persistida pela fonte de dados ativa.',
        variant: 'success',
      })
    },
  })
}

export function useUpdateOptionAvailabilityMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateOptionAvailabilityRequest) =>
      catalogService.updateOptionAvailability(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Opcao atualizada',
        description: 'A disponibilidade global ja reflete no pedido, cardapio e IA.',
        variant: 'success',
      })
    },
  })
}

export function useApplyOptionGroupToCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ApplyOptionGroupToCategoryRequest) =>
      catalogService.applyOptionGroupToCategory(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Grupo aplicado',
        description: `${response.data.affectedProducts} produto(s) receberam a aplicacao automatica quando faltava vinculo.`,
        variant: 'success',
      })
    },
  })
}

export function useUpdateProductOptionGroupLinkMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateProductOptionGroupLinkRequest) =>
      catalogService.updateProductOptionGroupLink(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Aplicacao personalizada',
        description: 'O produto foi atualizado dentro da fonte unica do catalogo.',
        variant: 'success',
      })
    },
  })
}

export function useSavePromotionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (promotion: Promotion) => catalogService.savePromotion({ promotion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Promocao salva',
        description: 'A promoção já está disponível na loja.',
        variant: 'success',
      })
    },
  })
}

export function useDeletePromotionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (promotionId: string) => catalogService.deletePromotion(promotionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Promocao desativada',
        description: 'A promocao foi mantida no historico e marcada como inativa.',
        variant: 'success',
      })
    },
  })
}

export function useSaveCouponMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (coupon: Coupon) => catalogService.saveCoupon({ coupon }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Cupom salvo',
        description: 'O cupom já está disponível na loja.',
        variant: 'success',
      })
    },
  })
}

export function useDeleteCouponMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (couponId: string) => catalogService.deleteCoupon(couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      useToastStore.getState().pushToast({
        title: 'Cupom desativado',
        description: 'O cupom foi mantido no historico e marcado como inativo.',
        variant: 'success',
      })
    },
  })
}
