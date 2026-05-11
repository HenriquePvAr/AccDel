import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/hooks/queries/query-keys'
import { driverService } from '@/services'
import { useToastStore } from '@/stores/toast-store'
import type {
  DriverRoutePreviewRequest,
  GetDriverDispatchCandidatesRequest,
  GetDriverRouteRequest,
  SaveDriverRequest,
  UpdateDriverLocationRequest,
  UpdateDriverQueueRequest,
} from '@/contracts'

export function useDriversQuery() {
  return useQuery({
    queryKey: queryKeys.drivers.list,
    queryFn: () => driverService.listDrivers(),
  })
}

export function useDriverByIdQuery(driverId: string | null) {
  return useQuery({
    enabled: Boolean(driverId),
    queryKey: queryKeys.drivers.detail(driverId),
    queryFn: () => driverService.getDriverById({ driverId: driverId! }),
  })
}

export function useDriverLocationsQuery() {
  return useQuery({
    queryKey: queryKeys.drivers.locations,
    queryFn: () => driverService.listLocations(),
  })
}

export function useDriverRouteQuery(request: GetDriverRouteRequest | null) {
  return useQuery({
    enabled: Boolean(request?.driverId),
    queryKey: queryKeys.drivers.route(request?.driverId ?? null),
    queryFn: () => driverService.getRoute({ driverId: request!.driverId }),
  })
}

export function useDriverDispatchCandidatesQuery(
  request: GetDriverDispatchCandidatesRequest | null,
) {
  return useQuery({
    enabled: Boolean(request?.driverId),
    queryKey: queryKeys.drivers.dispatchCandidates(request?.driverId ?? null),
    queryFn: () => driverService.getDispatchCandidates({ driverId: request!.driverId }),
  })
}

export function useDriverRoutePreviewMutation() {
  return useMutation({
    mutationFn: (request: DriverRoutePreviewRequest) => driverService.previewRoute(request),
  })
}

export function useSaveDriverMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SaveDriverRequest) => driverService.saveDriver(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.route(response.data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.detail(response.data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.locations })
      useToastStore.getState().pushToast({
        title: 'Motoboy salvo',
        description: 'Cadastro operacional atualizado com sucesso.',
        variant: 'success',
      })
    },
  })
}

export function useUpdateDriverQueueMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateDriverQueueRequest) => driverService.updateQueue(request),
    onSuccess: (_response, request) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.route(request.driverId) })
      queryClient.invalidateQueries({
        queryKey: queryKeys.drivers.dispatchCandidates(request.driverId),
      })
      useToastStore.getState().pushToast({
        title: 'Fila atualizada',
        description: 'A ordem da rota foi salva com sucesso.',
        variant: 'success',
      })
    },
  })
}

export function useUpdateDriverLocationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateDriverLocationRequest) => driverService.updateLocation(request),
    onSuccess: (_response, request) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.locations })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.route(request.driverId) })
      useToastStore.getState().pushToast({
        title: 'Localizacao atualizada',
        description: 'O tracking refletiu a nova posicao e a rota sera recalculada.',
        variant: 'success',
      })
    },
  })
}
