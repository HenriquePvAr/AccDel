import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { driverApi } from '../api/driver'

const driverQueryKeys = {
  appState: ['driver-app', 'app-state'] as const,
}

export function useDriverAppStateQuery(enabled: boolean) {
  return useQuery({
    queryKey: driverQueryKeys.appState,
    queryFn: () => driverApi.getAppState(),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  })
}

export function useDriverActions() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: driverQueryKeys.appState,
    })

  const startDelivery = useMutation({
    mutationFn: () => driverApi.startDelivery(),
    onSuccess: invalidate,
  })

  const completeDelivery = useMutation({
    mutationFn: () => driverApi.completeDelivery(),
    onSuccess: invalidate,
  })

  const updateStatus = useMutation({
    mutationFn: (availability: 'available' | 'delivering' | 'paused') =>
      driverApi.updateStatus({ availability }),
    onSuccess: invalidate,
  })

  return {
    startDelivery,
    completeDelivery,
    updateStatus,
    invalidate,
  }
}

export { driverQueryKeys }
