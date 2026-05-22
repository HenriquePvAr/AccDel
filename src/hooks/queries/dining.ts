import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  AddTableSessionItemRequest,
  AddTableSessionItemsRequest,
  CloseTableSessionRequest,
  OpenTableSessionRequest,
  SplitTableSessionRequest,
  TransferTableSessionRequest,
  UpdateTableSessionRequest,
} from '@/contracts'
import { queryKeys } from '@/hooks/queries/query-keys'
import { diningService } from '@/services'
import { useToastStore } from '@/stores/toast-store'

function invalidateDiningRelatedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dining.tables })
  queryClient.invalidateQueries({ queryKey: ['waiters'] })
  queryClient.invalidateQueries({ queryKey: ['reports'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
  queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
}

export function useDiningTablesQuery() {
  return useQuery({
    queryKey: queryKeys.dining.tables,
    queryFn: () => diningService.getDiningTables(),
  })
}

export function useOpenTableSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: OpenTableSessionRequest) => diningService.openTableSession(request),
    onSuccess: (_, variables) => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Mesa aberta',
        description: `A sessao da mesa foi iniciada para ${variables.guestCount} pessoa(s).`,
        variant: 'success',
      })
    },
  })
}

export function useAddTableSessionItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: AddTableSessionItemRequest) => diningService.addSessionItem(request),
    onSuccess: () => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Consumo atualizado',
        description: 'O item entrou na comanda e foi enviado para a cozinha.',
        variant: 'success',
      })
    },
  })
}

export function useAddTableSessionItemsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: AddTableSessionItemsRequest) => diningService.addSessionItems(request),
    onSuccess: (_, variables) => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Itens enviados',
        description: `${variables.items.length} item(ns) entraram na comanda e em uma unica ficha da cozinha.`,
        variant: 'success',
      })
    },
  })
}

export function useUpdateTableSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateTableSessionRequest) => diningService.updateSession(request),
    onSuccess: (_, variables) => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Sessao atualizada',
        description:
          variables.status === 'awaiting_close'
            ? 'A mesa foi sinalizada para fechamento.'
            : 'Os dados operacionais da mesa foram atualizados.',
        variant: 'success',
      })
    },
  })
}

export function useCloseTableSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CloseTableSessionRequest) => diningService.closeSession(request),
    onSuccess: () => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Conta fechada',
        description: 'A mesa foi fechada e o caixa recebeu a movimentacao correspondente.',
        variant: 'success',
      })
    },
  })
}

export function useTransferTableSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: TransferTableSessionRequest) => diningService.transferSession(request),
    onSuccess: () => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Mesa transferida',
        description: 'A sessao foi movida para a nova mesa e o mapa ja foi atualizado.',
        variant: 'success',
      })
    },
  })
}

export function useSplitTableSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SplitTableSessionRequest) => diningService.splitSession(request),
    onSuccess: () => {
      invalidateDiningRelatedQueries(queryClient)
      useToastStore.getState().pushToast({
        title: 'Conta separada',
        description: 'A separacao foi registrada e a conta parcial ja foi encerrada.',
        variant: 'success',
      })
    },
  })
}
