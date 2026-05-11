import type {
  DriverDispatchCandidate,
  DriverRoutePreviewRequest,
  DriverRoutePreviewResponse,
  GetDriverDispatchCandidatesRequest,
  GetDriverDispatchCandidatesResponse,
  GetDriverByIdRequest,
  GetDriverByIdResponse,
  GetDriverRouteRequest,
  GetDriverRouteResponse,
  ListDriverLocationsResponse,
  ListDriversResponse,
  SaveDriverRequest,
  SaveDriverResponse,
  UpdateDriverLocationRequest,
  UpdateDriverLocationResponse,
  UpdateDriverQueueRequest,
  UpdateDriverQueueResponse,
} from '@/contracts'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import { apiClient, shouldUseApi } from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { simulateAsync } from '@/services/utils'
import type { Driver, DriverConnectionStatus, DriverLocation } from '@/types'

import { buildDriverLocationsResponse, buildDriversResponse } from './drivers-adapter'

const storeCoordinate = {
  longitude: -60.0217,
  latitude: -3.1019,
}

export const driverService = {
  async listDrivers(): Promise<ListDriversResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListDriversResponse>('/drivers')
    }

    return simulateAsync(buildDriversResponse(getDemoDatabase().drivers.drivers))
  },

  async getDriverById(request: GetDriverByIdRequest): Promise<GetDriverByIdResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetDriverByIdResponse>(`/drivers/${request.driverId}`)
    }

    const driver = getDemoDatabase().drivers.drivers.find((entry) => entry.id === request.driverId)

    return simulateAsync({ data: driver! })
  },

  async saveDriver(request: SaveDriverRequest): Promise<SaveDriverResponse> {
    if (shouldUseApi) {
      if (request.driver.id) {
        return apiClient.patch<SaveDriverResponse, SaveDriverRequest>(
          `/drivers/${request.driver.id}`,
          request,
        )
      }

      return apiClient.post<SaveDriverResponse, SaveDriverRequest>('/drivers', request)
    }

    const nextDb = mutateDemoDatabase((database) => {
      const existingIndex = database.drivers.drivers.findIndex(
        (entry) => entry.id === request.driver.id,
      )
      const current = existingIndex >= 0 ? database.drivers.drivers[existingIndex] : null
      const connectionStatus: DriverConnectionStatus = request.driver.active
        ? 'online'
        : 'offline'
      const driver: Driver = {
        id: request.driver.id ?? crypto.randomUUID(),
        name: request.driver.name,
        email: request.driver.email,
        phone: request.driver.phone,
        vehicle: request.driver.vehicle,
        active: request.driver.active,
        connectionStatus,
        availability: request.driver.active ? request.driver.availability : 'paused',
        currentOrderId: current?.currentOrderId,
        averageDeliveryMinutes: current?.averageDeliveryMinutes ?? 0,
        distanceKmToday: current?.distanceKmToday ?? 0,
        totalDeliveries: current?.totalDeliveries ?? 0,
        completedOrders: current?.completedOrders ?? 0,
        cancelledOrders: current?.cancelledOrders ?? 0,
        totalAssignedRevenue: current?.totalAssignedRevenue ?? 0,
        lastActivityAt: new Date().toISOString(),
        queue: current?.queue ?? [],
        history: current?.history ?? [],
      }

      if (existingIndex >= 0) {
        database.drivers.drivers[existingIndex] = driver
      } else {
        database.drivers.drivers.unshift(driver)
      }

      return database
    })

    const saved =
      nextDb.drivers.drivers.find((entry) => entry.id === request.driver.id) ??
      nextDb.drivers.drivers[0]

    return simulateAsync({ data: saved })
  },

  async listLocations(): Promise<ListDriverLocationsResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListDriverLocationsResponse>('/drivers/locations/active')
    }

    if (!shouldUseApi) {
      return simulateAsync(
        buildDriverLocationsResponse(
          getDemoDatabase().drivers.locations.map(enrichLocationWithCoordinates),
        ),
      )
    }

    return simulateAsync(buildDriverLocationsResponse([]))
  },

  async getRoute(request: GetDriverRouteRequest): Promise<GetDriverRouteResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetDriverRouteResponse>(`/drivers/${request.driverId}/route`)
    }

    const driver = getDemoDatabase().drivers.drivers.find((entry) => entry.id === request.driverId)
    const location = getDemoDatabase().drivers.locations
      .map(enrichLocationWithCoordinates)
      .find((entry) => entry.driverId === request.driverId)

    return simulateAsync({
      data: {
        driverId: request.driverId,
        driverName: driver?.name ?? 'Motoboy',
        storeLocation: storeCoordinate,
        currentLocation: location ?? null,
        stops: driver?.queue ?? [],
        geometry: [location ?? storeCoordinate, ...(driver?.queue ?? []).map((stop, index) => ({
          longitude: stop.longitude ?? storeCoordinate.longitude + (index + 1) * 0.004,
          latitude: stop.latitude ?? storeCoordinate.latitude + (index + 1) * 0.003,
        }))].map((point) => ({
          longitude: point.longitude ?? storeCoordinate.longitude,
          latitude: point.latitude ?? storeCoordinate.latitude,
        })),
        etaMinutes: driver?.queue[0]?.etaMinutes ?? 0,
        durationSeconds: (driver?.queue[0]?.etaMinutes ?? 0) * 60,
        distanceMeters: 0,
        provider: 'fallback',
        updatedAt: new Date().toISOString(),
      },
    })
  },

  async getDispatchCandidates(
    request: GetDriverDispatchCandidatesRequest,
  ): Promise<GetDriverDispatchCandidatesResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetDriverDispatchCandidatesResponse>(
        `/drivers/${request.driverId}/dispatch-candidates`,
      )
    }

    const database = getDemoDatabase()
    const driver = database.drivers.drivers.find((entry) => entry.id === request.driverId)
    const readyOrders = database.orders.filter(
      (order) => order.status === 'ready' && order.source === 'delivery',
    )
    const candidates: DriverDispatchCandidate[] = readyOrders.map((order, index) => ({
      orderId: order.id,
      orderNumber: order.number,
      customerName: order.customerName,
      addressLabel: order.addressLabel ?? order.addressText ?? 'Entrega',
      addressText: order.addressText,
      source: order.source,
      total: order.total,
      priority: order.priority,
      distanceFromStoreMeters: 900 + index * 420,
      etaFromStoreMinutes: 6 + index * 3,
      addedEtaMinutes: driver?.queue.length ? 4 + index * 2 : 6 + index * 3,
      routeEtaAfterAssignmentMinutes: driver?.queue.length ? 18 + index * 4 : 10 + index * 3,
      bestInsertionSequence: Math.min((driver?.queue.length ?? 0) + 1, index + 1),
      suggested: index === 0,
      suggestionLabel:
        index === 0
          ? 'Melhor proximo pedido por proximidade'
          : `Adicionar este pedido aumenta +${4 + index * 2} min`,
    }))

    return simulateAsync({ data: candidates })
  },

  async previewRoute(request: DriverRoutePreviewRequest): Promise<DriverRoutePreviewResponse> {
    if (shouldUseApi) {
      return apiClient.post<DriverRoutePreviewResponse, Omit<DriverRoutePreviewRequest, 'driverId'>>(
        `/drivers/${request.driverId}/route-preview`,
        {
          previewOrderId: request.previewOrderId,
          insertionSequence: request.insertionSequence,
          proposedOrderIds: request.proposedOrderIds,
        },
      )
    }

    const route = await this.getRoute({ driverId: request.driverId })

    return simulateAsync({
      data: {
        driverId: request.driverId,
        previewOrderId: request.previewOrderId ?? null,
        insertedSequence: request.insertionSequence ?? null,
        severity: 'low',
        addedEtaMinutes: 4,
        addedDistanceMeters: 850,
        routeCompatibilityScore: 88,
        recommendation: 'Melhor proximo pedido por proximidade.',
        currentRoute: route.data,
        previewRoute: route.data,
      },
    })
  },

  async updateQueue(request: UpdateDriverQueueRequest): Promise<UpdateDriverQueueResponse> {
    if (shouldUseApi) {
      return apiClient.patch<UpdateDriverQueueResponse, { orderIds: string[] }>(
        `/drivers/${request.driverId}/queue`,
        {
          orderIds: request.queue.map((stop) => stop.orderId),
        },
      )
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.drivers.drivers = database.drivers.drivers.map((driver) =>
        driver.id === request.driverId ? { ...driver, queue: request.queue } : driver,
      )
      return database
    })

    const updated = nextDb.drivers.drivers.find((driver) => driver.id === request.driverId)!
    mockRealtimeBus.emit('driver.queue_updated', { driverId: updated.id })
    return simulateAsync({ data: updated })
  },

  async updateLocation(
    request: UpdateDriverLocationRequest,
  ): Promise<UpdateDriverLocationResponse> {
    if (shouldUseApi) {
      if (request.latitude !== undefined && request.longitude !== undefined) {
        return apiClient.post<UpdateDriverLocationResponse, Omit<UpdateDriverLocationRequest, 'driverId'>>(
          `/drivers/${request.driverId}/location`,
          {
            latitude: request.latitude,
            longitude: request.longitude,
            speedKmh: request.speedKmh,
            heading: request.heading,
            accuracyMeters: request.accuracyMeters,
            capturedAt: request.capturedAt,
            source: request.source ?? 'admin',
            status: request.status,
            currentOrderId: request.currentOrderId,
            currentAssignmentId: request.currentAssignmentId,
          },
        )
      }

      return apiClient.post<UpdateDriverLocationResponse, Omit<UpdateDriverLocationRequest, 'driverId'>>(
        `/drivers/${request.driverId}/simulate-location`,
        {
          speedKmh: request.speedKmh,
        },
      )
    }

    const nextDb = mutateDemoDatabase((database) => {
      const locationIndex = database.drivers.locations.findIndex(
        (entry) => entry.driverId === request.driverId,
      )
      if (locationIndex < 0) {
        return database
      }

      const current = database.drivers.locations[locationIndex]
      database.drivers.locations[locationIndex] = {
        ...current,
        x: request.x ?? Math.min(92, current.x + 3),
        y: request.y ?? Math.max(12, current.y - 2),
        longitude: request.longitude ?? current.longitude,
        latitude: request.latitude ?? current.latitude,
        speedKmh: request.speedKmh ?? Math.max(12, current.speedKmh + 4),
        capturedAt: new Date().toISOString(),
      }

      return database
    })

    const updated = enrichLocationWithCoordinates(
      nextDb.drivers.locations.find((entry) => entry.driverId === request.driverId)!,
    )
    mockRealtimeBus.emit('driver.location_updated', {
      driverId: request.driverId,
      location: updated,
    })
    return simulateAsync({ data: updated })
  },
}

function enrichLocationWithCoordinates(location: DriverLocation): DriverLocation {
  if (location.longitude && location.latitude) {
    return location
  }

  return {
    ...location,
    longitude: storeCoordinate.longitude + (location.x - 50) * 0.0012,
    latitude: storeCoordinate.latitude - (location.y - 50) * 0.0009,
    accuracyMeters: location.speedKmh > 0 ? 18 : 35,
  }
}
