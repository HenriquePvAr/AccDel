import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  GetKitchenQueueRequest,
  MarkKitchenOrderReadyRequest,
  MoveKitchenOrderRequest,
} from '@/contracts'
import { queryKeys } from '@/hooks/queries/query-keys'
import { kitchenService } from '@/services'
import { useToastStore } from '@/stores/toast-store'

export function useKitchenQueueQuery(request?: GetKitchenQueueRequest) {
  return useQuery({
    queryKey: queryKeys.kitchen.queue(request?.filters ?? {}),
    queryFn: () => kitchenService.getQueue(request),
    refetchInterval: 30_000,
  })
}

export function useMoveKitchenOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: MoveKitchenOrderRequest) => kitchenService.moveOrder(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(response.data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'KDS atualizado',
        description: `${response.data.number} mudou para ${response.data.status}.`,
        variant: 'success',
      })
    },
  })
}

export function useMarkKitchenOrderReadyMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: MarkKitchenOrderReadyRequest) =>
      kitchenService.markOrderReady(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(response.data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'Pedido pronto',
        description: `${response.data.number} saiu da fila de producao.`,
        variant: 'success',
      })
    },
  })
}
