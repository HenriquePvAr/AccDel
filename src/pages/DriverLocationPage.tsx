import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Move, RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DriverDispatchCandidate, ListResponse } from '@/contracts'
import {
  DeliveryDetailsPanel,
  DriverCompactList,
  DriverMapPanel,
  DriverOrdersModal,
} from '@/features/drivers/components'
import {
  driverStatusFilterOptions,
  formatDriverLastUpdate,
  getPrimaryStop,
  matchesDriverFilter,
  type DriverSortOption,
  type DriverStatusFilter,
} from '@/features/drivers/components/driver-location-utils'
import {
  useDriverLocationsQuery,
  useDriverDispatchCandidatesQuery,
  useDriverRoutePreviewMutation,
  useDriverRouteQuery,
  useDriversQuery,
  useOrderByIdQuery,
  useUpdateOrderStatusMutation,
  useUpdateDriverLocationMutation,
  useUpdateDriverQueueMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { queryKeys } from '@/hooks/queries/query-keys'
import { cn } from '@/lib/utils'
import { subscribeToAdminRealtime } from '@/services/realtime/admin-realtime-stream'
import { useDriversStore } from '@/stores'
import type { Driver, DriverLocation } from '@/types'

const EMPTY_DRIVERS: Driver[] = []
const EMPTY_LOCATIONS: DriverLocation[] = []

interface DriverRouteDraftState {
  driverId: string | null
  sourceOrderIds: string[]
  draftOrderIds: string[]
}

function areSameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function DriverLocationPage() {
  usePageTitle('Localizacao dos motoboys')
  const queryClient = useQueryClient()
  const driversQuery = useDriversQuery()
  const locationsQuery = useDriverLocationsQuery()
  const updateQueueMutation = useUpdateDriverQueueMutation()
  const updateLocationMutation = useUpdateDriverLocationMutation()
  const drivers = driversQuery.data?.data ?? EMPTY_DRIVERS
  const locations = locationsQuery.data?.data ?? EMPTY_LOCATIONS
  const selectedDriverId = useDriversStore((state) => state.selectedDriverId)
  const setSelectedDriverId = useDriversStore((state) => state.setSelectedDriverId)
  const canManageDelivery = useCan('settings:delivery:manage')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DriverStatusFilter>('all')
  const [sortBy, setSortBy] = useState<DriverSortOption>('default')
  const [autoTrackingDevEnabled, setAutoTrackingDevEnabled] = useState(false)
  const [dispatchCenterOpen, setDispatchCenterOpen] = useState(false)
  const [routeDraft, setRouteDraft] = useState<DriverRouteDraftState | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const driverStatusCounts = useMemo(
    () => ({
      all: drivers.length,
      delivering: drivers.filter((driver) => matchesDriverFilter(driver, 'delivering')).length,
      available: drivers.filter((driver) => matchesDriverFilter(driver, 'available')).length,
      paused: drivers.filter((driver) => matchesDriverFilter(driver, 'paused')).length,
      offline: drivers.filter((driver) => matchesDriverFilter(driver, 'offline')).length,
    }),
    [drivers],
  )
  const visibleDrivers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return drivers
      .filter((driver) => matchesDriverFilter(driver, statusFilter))
      .filter((driver) => {
        if (!normalizedSearch) {
          return true
        }

        const primaryStop = getPrimaryStop(driver)
        const searchableFields = [
          driver.name,
          driver.phone,
          driver.vehicle,
          primaryStop?.orderNumber,
          primaryStop?.customerName,
          primaryStop?.addressLabel,
        ]

        return searchableFields.some((field) => field?.toLowerCase().includes(normalizedSearch))
      })
      .sort((left, right) => sortDrivers(left, right, sortBy, locations))
  }, [drivers, locations, search, sortBy, statusFilter])
  const visibleDriverIds = useMemo(
    () => new Set(visibleDrivers.map((driver) => driver.id)),
    [visibleDrivers],
  )
  const visibleLocations = useMemo(
    () => locations.filter((location) => visibleDriverIds.has(location.driverId)),
    [locations, visibleDriverIds],
  )

  useEffect(() => {
    if (!visibleDrivers.length) {
      if (selectedDriverId) {
        setSelectedDriverId(null)
      }
      return
    }

    if (selectedDriverId && visibleDrivers.some((driver) => driver.id === selectedDriverId)) {
      return
    }

    const prioritizedDriver = visibleDrivers.find((driver) => driver.queue.length) ?? visibleDrivers[0]
    if (prioritizedDriver && prioritizedDriver.id !== selectedDriverId) {
      setSelectedDriverId(prioritizedDriver.id)
    }
  }, [selectedDriverId, setSelectedDriverId, visibleDrivers])

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  )
  const selectedLocation = useMemo(
    () => locations.find((entry) => entry.driverId === selectedDriverId) ?? null,
    [locations, selectedDriverId],
  )
  const routeRequest =
    selectedDriver?.queue.length || selectedDriver?.currentOrderId
      ? { driverId: selectedDriver.id }
      : null
  const routeQuery = useDriverRouteQuery(routeRequest)
  const dispatchCandidatesQuery = useDriverDispatchCandidatesQuery(
    dispatchCenterOpen && selectedDriver ? { driverId: selectedDriver.id } : null,
  )
  const routePreviewMutation = useDriverRoutePreviewMutation()
  const updateOrderStatusMutation = useUpdateOrderStatusMutation()
  const selectedPrimaryStop = selectedDriver ? getPrimaryStop(selectedDriver, routeQuery.data?.data) : null
  const selectedOrderId = selectedPrimaryStop?.orderId ?? selectedDriver?.currentOrderId ?? null
  const selectedOrderQuery = useOrderByIdQuery(selectedOrderId)
  const canAutoTrackSelectedDriver =
    Boolean(selectedDriver?.queue.length) && selectedDriver?.availability === 'delivering'
  const autoTrackingDescription = useMemo(() => {
    if (!selectedDriver) {
      return 'Selecione um motoboy em entrega para simular tracking automatico.'
    }

    if (!canAutoTrackSelectedDriver) {
      return 'Tracking automatico fica bloqueado sem entrega ativa.'
    }

    return 'Simulacao de app do motoboy: 1 envio por minuto enquanto houver entrega ativa.'
  }, [canAutoTrackSelectedDriver, selectedDriver])
  const latestVisibleUpdate = useMemo(() => {
    if (!visibleLocations.length) {
      return 'Sem localizacao recebida'
    }

    const latestLocation = visibleLocations.reduce((latest, current) => {
      return new Date(current.capturedAt).getTime() > new Date(latest.capturedAt).getTime()
        ? current
        : latest
    })

    return formatDriverLastUpdate(latestLocation)
  }, [visibleLocations])
  const routeOrderIds = useMemo(
    () => (routeQuery.data?.data?.stops ?? []).map((stop) => stop.orderId),
    [routeQuery.data?.data?.stops],
  )
  const draftOrderIds = useMemo(() => {
    if (
      routeDraft &&
      routeDraft.driverId === selectedDriverId &&
      areSameStringList(routeDraft.sourceOrderIds, routeOrderIds)
    ) {
      return routeDraft.draftOrderIds
    }

    return routeOrderIds
  }, [routeDraft, routeOrderIds, selectedDriverId])
  const routeDraftDirty = useMemo(
    () =>
      routeOrderIds.length > 0 &&
      (routeOrderIds.length !== draftOrderIds.length ||
        routeOrderIds.some((orderId, index) => orderId !== draftOrderIds[index])),
    [draftOrderIds, routeOrderIds],
  )
  const routePreview = routePreviewMutation.data?.data ?? null

  const updateDraftOrderIds = useCallback(
    (nextOrderIds: string[]) => {
      setRouteDraft({
        driverId: selectedDriverId,
        sourceOrderIds: routeOrderIds,
        draftOrderIds: nextOrderIds,
      })
    },
    [routeOrderIds, selectedDriverId],
  )

  useEffect(() => {
    const unsubscribe = subscribeToAdminRealtime({
      onConnectionChange: setRealtimeConnected,
      onEvent: (event) => {
        if (event.name === 'driver.location_updated') {
          const { location } = event.payload
          queryClient.setQueryData<ListResponse<DriverLocation>>(
            queryKeys.drivers.locations,
            (current) => {
              if (!current) {
                return {
                  data: [location],
                  meta: {
                    page: 1,
                    pageSize: 1,
                    total: 1,
                    totalPages: 1,
                  },
                }
              }

              const existingIndex = current.data.findIndex(
                (entry) => entry.driverId === location.driverId,
              )
              const nextData =
                existingIndex >= 0
                  ? current.data.map((entry, index) =>
                      index === existingIndex ? location : entry,
                    )
                  : [location, ...current.data]

              return {
                ...current,
                data: nextData,
                meta: {
                  ...current.meta,
                  total: nextData.length,
                },
              }
            },
          )
          queryClient.invalidateQueries({
            queryKey: queryKeys.drivers.route(event.payload.driverId),
          })
          return
        }

        if (event.name === 'driver.queue_updated') {
          queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
          queryClient.invalidateQueries({
            queryKey: queryKeys.drivers.route(event.payload.driverId),
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.drivers.dispatchCandidates(event.payload.driverId),
          })
          return
        }

        if (event.name === 'driver.status_updated') {
          queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
          if (event.payload.driverId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.drivers.route(event.payload.driverId),
            })
          }
          return
        }

        if (event.name === 'order.status_changed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
          if (event.payload.driverId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.drivers.route(event.payload.driverId),
            })
            queryClient.invalidateQueries({
              queryKey: queryKeys.drivers.dispatchCandidates(event.payload.driverId),
            })
          }
        }
      },
    })

    return unsubscribe
  }, [queryClient])

  useEffect(() => {
    if (!autoTrackingDevEnabled || !selectedDriver || !canAutoTrackSelectedDriver) {
      return
    }

    const interval = window.setInterval(() => {
      updateLocationMutation.mutate({
        driverId: selectedDriver.id,
        speedKmh: Math.max(18, selectedLocation?.speedKmh ?? 26),
        status: selectedDriver.availability,
        currentOrderId: selectedDriver.currentOrderId,
        currentAssignmentId: selectedDriver.queue[0]?.id,
        source: 'simulator',
      })
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [
    autoTrackingDevEnabled,
    canAutoTrackSelectedDriver,
    selectedDriver,
    selectedLocation?.speedKmh,
    updateLocationMutation,
  ])

  const handleRefresh = async () => {
    await Promise.all([
      driversQuery.refetch(),
      locationsQuery.refetch(),
      routeQuery.refetch(),
      selectedOrderId ? selectedOrderQuery.refetch() : Promise.resolve(),
    ])
  }

  const handleOpenDispatchCenter = (driverId: string) => {
    if (driverId !== selectedDriverId) {
      setSelectedDriverId(driverId)
    }
    setDispatchCenterOpen(true)
  }

  const handleAssignReadyOrder = (orderId: string) => {
    if (!selectedDriver) {
      return
    }

    updateOrderStatusMutation.mutate(
      {
        orderId,
        action: 'dispatch',
        driverId: selectedDriver.id,
      },
      {
        onSuccess: () => {
          routePreviewMutation.reset()
        },
      },
    )
  }

  const handlePreviewCandidate = (candidate: DriverDispatchCandidate) => {
    if (!selectedDriver) {
      return
    }

    routePreviewMutation.mutate({
      driverId: selectedDriver.id,
      previewOrderId: candidate.orderId,
      insertionSequence: candidate.bestInsertionSequence,
      proposedOrderIds: draftOrderIds.length ? draftOrderIds : undefined,
    })
  }

  const handleReorderRoute = (nextOrderIds: string[]) => {
    if (!selectedDriver) {
      return
    }

    updateDraftOrderIds(nextOrderIds)
    routePreviewMutation.mutate({
      driverId: selectedDriver.id,
      proposedOrderIds: nextOrderIds,
      previewOrderId: routePreview?.previewOrderId ?? undefined,
    })
  }

  const handleSaveRouteOrder = () => {
    if (!selectedDriver || !routeDraftDirty) {
      return
    }

    const stopMap = new Map((routeQuery.data?.data?.stops ?? []).map((stop) => [stop.orderId, stop]))
    const queue = draftOrderIds
      .map((orderId, index) => {
        const stop = stopMap.get(orderId)

        if (!stop) {
          return null
        }

        return {
          ...stop,
          plannedSequence: index + 1,
          finalSequence: index + 1,
        }
      })
      .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop))

    updateQueueMutation.mutate(
      {
        driverId: selectedDriver.id,
        queue,
      },
      {
        onSuccess: () => {
          routePreviewMutation.reset()
        },
      },
    )
  }

  const handleClearPreview = () => {
    routePreviewMutation.reset()
    setRouteDraft(null)
  }

  const devControls =
    canManageDelivery && selectedDriver ? (
      <>
        {selectedDriver.queue.length > 1 ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={updateQueueMutation.isPending}
            onClick={() => {
              if (!selectedDriver || selectedDriver.queue.length < 2) {
                return
              }

              const [first, second, ...rest] = selectedDriver.queue
              updateQueueMutation.mutate({
                driverId: selectedDriver.id,
                queue: [
                  { ...second, finalSequence: 1 },
                  { ...first, finalSequence: 2 },
                  ...rest,
                ],
              })
            }}
          >
            <ArrowDownUp className="h-4 w-4" />
            Inverter proxima entrega
          </Button>
        ) : null}
        {selectedLocation ? (
          <Button
            variant="outline"
            size="sm"
            disabled={updateLocationMutation.isPending}
            onClick={() =>
              updateLocationMutation.mutate({
                driverId: selectedDriver.id,
                speedKmh: Math.max(18, selectedLocation.speedKmh || 28),
                status: selectedDriver.availability,
                currentOrderId: selectedDriver.currentOrderId,
                currentAssignmentId: selectedDriver.queue[0]?.id,
                source: 'simulator',
              })
            }
          >
            <Move className="h-4 w-4" />
            Simular 1 minuto
          </Button>
        ) : null}
        <Button
          variant={autoTrackingDevEnabled ? 'default' : 'outline'}
          size="sm"
          disabled={!canAutoTrackSelectedDriver}
          title={autoTrackingDescription}
          onClick={() => setAutoTrackingDevEnabled((enabled) => !enabled)}
        >
          Tracking auto {autoTrackingDevEnabled ? 'ativo' : 'dev'}
        </Button>
      </>
    ) : null

  return (
    <PageShell className="space-y-5">
      <SectionHeader
        title="Localizacao dos motoboys"
        description="Mapa operacional com tracking real, ETA, rota restante e lista compacta de motoboys para escalar a leitura da operacao."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-full border border-emerald-400/18 bg-emerald-400/8 px-3 py-2 text-xs font-bold text-emerald-200">
              Ultima atualizacao: {latestVisibleUpdate}
            </div>
            <Button variant="secondary" onClick={handleRefresh} disabled={driversQuery.isFetching || locationsQuery.isFetching}>
              <RefreshCcw className="h-4 w-4" />
              Atualizar agora
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {driverStatusFilterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatusFilter(option.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition',
              statusFilter === option.value
                ? 'border-primary/26 bg-primary/12 text-primary'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]',
            )}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', option.dotClassName)} />
            {option.label}
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
              {driverStatusCounts[option.value]}
            </span>
          </button>
        ))}
      </div>

      {driversQuery.isLoading || locationsQuery.isLoading ? (
        <Skeleton className="h-[720px] rounded-[26px]" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <DriverMapPanel
              drivers={visibleDrivers}
              locations={visibleLocations}
              route={routeQuery.data?.data ?? null}
              previewRoute={routePreview}
              routeLoading={routeQuery.isFetching}
              realtimeConnected={realtimeConnected}
              selectedDriverId={selectedDriverId}
              onSelectDriver={setSelectedDriverId}
              onOpenDispatchCenter={handleOpenDispatchCenter}
            />

            <DriverCompactList
              drivers={visibleDrivers}
              totalDrivers={drivers.length}
              locations={visibleLocations}
              selectedDriverId={selectedDriverId}
              onSelectDriver={setSelectedDriverId}
              onOpenDispatchCenter={handleOpenDispatchCenter}
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />
          </div>

          <DeliveryDetailsPanel
            driver={selectedDriver}
            location={routeQuery.data?.data?.currentLocation ?? selectedLocation}
            route={routeQuery.data?.data ?? null}
            previewRoute={routePreview}
            order={selectedOrderQuery.data?.data ?? null}
            routeLoading={routeQuery.isFetching || selectedOrderQuery.isFetching}
            realtimeConnected={realtimeConnected}
            devControls={devControls}
            onOpenDispatchCenter={
              selectedDriver ? () => handleOpenDispatchCenter(selectedDriver.id) : undefined
            }
          />
        </div>
      )}

      <DriverOrdersModal
        open={dispatchCenterOpen && Boolean(selectedDriver)}
        driver={selectedDriver}
        route={routeQuery.data?.data ?? null}
        candidates={dispatchCandidatesQuery.data?.data ?? []}
        preview={routePreview}
        previewLoading={routePreviewMutation.isPending}
        draftOrderIds={draftOrderIds}
        loading={dispatchCandidatesQuery.isLoading || dispatchCandidatesQuery.isFetching}
        busy={updateOrderStatusMutation.isPending || updateQueueMutation.isPending}
        onOpenChange={setDispatchCenterOpen}
        onAssign={handleAssignReadyOrder}
        onPreviewCandidate={handlePreviewCandidate}
        onClearPreview={handleClearPreview}
        onDraftOrderIdsChange={handleReorderRoute}
        onSaveDraftRoute={handleSaveRouteOrder}
      />
    </PageShell>
  )
}

function sortDrivers(
  left: Driver,
  right: Driver,
  sortBy: DriverSortOption,
  locations: Array<{ driverId: string; speedKmh: number; capturedAt: string }>,
) {
  const leftLocation = locations.find((location) => location.driverId === left.id)
  const rightLocation = locations.find((location) => location.driverId === right.id)
  const leftPrimaryStop = getPrimaryStop(left)
  const rightPrimaryStop = getPrimaryStop(right)

  if (sortBy === 'name') {
    return left.name.localeCompare(right.name)
  }

  if (sortBy === 'speed') {
    return (rightLocation?.speedKmh ?? 0) - (leftLocation?.speedKmh ?? 0)
  }

  if (sortBy === 'eta') {
    return (leftPrimaryStop?.etaMinutes ?? Number.MAX_SAFE_INTEGER) - (rightPrimaryStop?.etaMinutes ?? Number.MAX_SAFE_INTEGER)
  }

  if (sortBy === 'updated') {
    return (
      new Date(rightLocation?.capturedAt ?? 0).getTime() - new Date(leftLocation?.capturedAt ?? 0).getTime()
    )
  }

  const leftWeight = getDriverPriorityWeight(left)
  const rightWeight = getDriverPriorityWeight(right)
  if (leftWeight !== rightWeight) {
    return leftWeight - rightWeight
  }

  if ((leftPrimaryStop?.etaMinutes ?? Infinity) !== (rightPrimaryStop?.etaMinutes ?? Infinity)) {
    return (leftPrimaryStop?.etaMinutes ?? Infinity) - (rightPrimaryStop?.etaMinutes ?? Infinity)
  }

  return left.name.localeCompare(right.name)
}

function getDriverPriorityWeight(driver: Driver) {
  if (driver.connectionStatus === 'offline') {
    return 4
  }

  if (driver.availability === 'delivering') {
    return 1
  }

  if (driver.availability === 'paused') {
    return 3
  }

  return 2
}
