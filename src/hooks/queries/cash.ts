import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/hooks/queries/query-keys'
import { cashRegisterService } from '@/services'
import { useToastStore } from '@/stores/toast-store'
import type { CashMovementType } from '@/types'

export function useCashRegisterQuery() {
  return useQuery({
    queryKey: queryKeys.cash.current,
    queryFn: () => cashRegisterService.getCurrentRegister(),
  })
}

export function useRegisterCashMovementMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      type,
      amount,
      label,
    }: {
      type: CashMovementType
      amount: number
      label: string
    }) => cashRegisterService.registerMovement({ type, amount, label }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      useToastStore.getState().pushToast({
        title: 'Movimento registrado',
        description: 'O caixa refletiu a atualizacao imediatamente.',
        variant: 'success',
      })
    },
  })
}

export function useCloseCashRegisterMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (countedAmount?: number) => cashRegisterService.closeRegister({ countedAmount }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      useToastStore.getState().pushToast({
        title: 'Caixa fechado',
        description: 'O fechamento mock foi persistido para a demo.',
        variant: 'success',
      })
    },
  })
}
