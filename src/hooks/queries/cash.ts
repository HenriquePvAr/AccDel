import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/hooks/queries/query-keys'
import { cashRegisterService } from '@/services'
import { useToastStore } from '@/stores/toast-store'
import type { CashRegisterHistoryFilters } from '@/contracts'
import type { CashMovementType } from '@/types'

export function useCashRegisterQuery() {
  return useQuery({
    queryKey: queryKeys.cash.current,
    queryFn: () => cashRegisterService.getCurrentRegister(),
  })
}

export function useCashTerminalsQuery() {
  return useQuery({
    queryKey: [...queryKeys.cash.current, 'terminals'],
    queryFn: () => cashRegisterService.listTerminals(),
  })
}

export function useCashHistoryQuery(filters: CashRegisterHistoryFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.cash.current, 'history', filters],
    queryFn: () => cashRegisterService.listHistory(filters),
  })
}

export function useOpenCashRegisterMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: { terminalId?: string; openingAmount: number; note?: string }) =>
      cashRegisterService.openRegister(request),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'Caixa aberto',
        description: 'Abertura registrada com valor inicial real.',
        variant: 'success',
      })
    },
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

export function useSupplyCashMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      registerId,
      amount,
      reason,
    }: {
      registerId: string
      amount: number
      reason: string
    }) => cashRegisterService.supply(registerId, { amount, reason }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.cash.current, 'history'] })
      useToastStore.getState().pushToast({
        title: 'Dinheiro adicionado',
        description: 'Movimento auditavel registrado no caixa.',
        variant: 'success',
      })
    },
  })
}

export function useWithdrawCashMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      registerId,
      amount,
      reason,
    }: {
      registerId: string
      amount: number
      reason: string
    }) => cashRegisterService.withdraw(registerId, { amount, reason }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.cash.current, 'history'] })
      useToastStore.getState().pushToast({
        title: 'Dinheiro retirado',
        description: 'Retirada registrada com saldo recalculado no backend.',
        variant: 'success',
      })
    },
  })
}

export function useAdjustCashMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      registerId,
      originalMovementId,
      amount,
      direction,
      reason,
    }: {
      registerId: string
      originalMovementId: string
      amount: number
      direction: 'increase' | 'decrease'
      reason: string
    }) => cashRegisterService.adjust(registerId, { originalMovementId, amount, direction, reason }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.cash.current, 'history'] })
      useToastStore.getState().pushToast({
        title: 'Correcao registrada',
        description: 'O movimento original foi preservado e um ajuste compensatorio foi criado.',
        variant: 'success',
      })
    },
  })
}

export function useCloseCashRegisterMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      registerId,
      countedAmount,
      note,
      differenceReason,
    }: {
      registerId: string
      countedAmount: number
      note?: string
      differenceReason?: string
    }) => cashRegisterService.closeRegister(registerId, { countedAmount, note, differenceReason }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.cash.current, response)
      queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
      useToastStore.getState().pushToast({
        title: 'Caixa fechado',
        description: 'O fechamento foi persistido na fonte de dados ativa.',
        variant: 'success',
      })
    },
  })
}
