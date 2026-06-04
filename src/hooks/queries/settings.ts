import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  SaveDeliveryZoneRequest,
  SavePaymentMethodConfigRequest,
  UpdateOperationalSettingsRequest,
} from '@/contracts'
import { queryKeys } from '@/hooks/queries/query-keys'
import { settingsService } from '@/services'
import { useToastStore } from '@/stores/toast-store'

export function useStoreSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.store,
    queryFn: () => settingsService.getStoreSettings(),
  })
}

export function useUpdateOperationalSettingsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateOperationalSettingsRequest) =>
      settingsService.updateOperationalSettings(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.store })
      useToastStore.getState().pushToast({
        title: 'Configuracoes salvas',
        description: 'Os dados operacionais da loja foram atualizados.',
        variant: 'success',
      })
    },
  })
}

export function usePaymentMethodsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.payments,
    queryFn: () => settingsService.listPaymentMethods(),
  })
}

export function useDeliveryZonesQuery() {
  return useQuery({
    queryKey: queryKeys.settings.deliveryZones,
    queryFn: () => settingsService.listDeliveryZones(),
  })
}

export function useSaveDeliveryZoneMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SaveDeliveryZoneRequest) =>
      settingsService.saveDeliveryZone(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.deliveryZones })
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.store })
      queryClient.invalidateQueries({ queryKey: queryKeys.catalog.menuSource() })
      useToastStore.getState().pushToast({
        title: 'Bairro salvo',
        description: 'A taxa de entrega foi atualizada para o checkout e IA.',
        variant: 'success',
      })
    },
  })
}

export function useSavePaymentMethodMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SavePaymentMethodConfigRequest) =>
      settingsService.savePaymentMethod(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.payments })
      useToastStore.getState().pushToast({
        title: 'Forma de pagamento salva',
        description: 'A configuracao foi persistida para os canais selecionados.',
        variant: 'success',
      })
    },
  })
}
