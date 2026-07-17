import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { GetWaiterByIdRequest, SaveWaiterRequest, UpdateWaiterStatusRequest } from '@/contracts'
import { queryKeys } from '@/hooks/queries/query-keys'
import { waiterService } from '@/services/waiters/waiters-service'
import { useToastStore } from '@/stores/toast-store'

export function useWaitersQuery() {
  return useQuery({
    queryKey: queryKeys.waiters.list,
    queryFn: () => waiterService.listWaiters(),
  })
}

export function useWaiterByIdQuery(waiterId: string | null) {
  return useQuery({
    enabled: Boolean(waiterId),
    queryKey: queryKeys.waiters.detail(waiterId),
    queryFn: () => waiterService.getWaiterById({ waiterId: waiterId! } satisfies GetWaiterByIdRequest),
  })
}

export function useSaveWaiterMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SaveWaiterRequest) => waiterService.saveWaiter(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waiters.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.waiters.detail(response.data.id) })
      useToastStore.getState().pushToast({
        title: 'Garcom salvo',
        description: 'Cadastro atualizado na loja.',
        variant: 'success',
      })
    },
  })
}

export function useUpdateWaiterStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateWaiterStatusRequest) => waiterService.updateWaiterStatus(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waiters.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.waiters.detail(response.data.id) })
      useToastStore.getState().pushToast({
        title: response.data.active ? 'Garcom ativado' : 'Garcom desativado',
        description: 'Status atualizado com sucesso.',
        variant: 'success',
      })
    },
  })
}
