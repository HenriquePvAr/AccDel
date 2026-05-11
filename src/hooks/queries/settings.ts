import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { UpdateOperationalSettingsRequest } from '@/contracts'
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
        title: 'Estimativas salvas',
        description: 'Os tempos operacionais da loja foram atualizados.',
        variant: 'success',
      })
    },
  })
}
