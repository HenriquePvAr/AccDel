import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { DeliveryAssignment, DriverLocation, Order, Prisma, Store } from '@prisma/client'
import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'

import type {
  PreviewDriverRoutePayload,
  SaveDriverLocationPayload,
  SaveDriverPayload,
  SimulateDriverLocationPayload,
  UpdateDriverQueuePayload,
  UpdateDriverAvailabilityPayload,
} from '@/contracts/drivers.contract'
import { OrdersService } from '@/modules/orders/orders.service'
import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import {
  calculateRouteEta,
  estimatePolylineDistance,
  type GeoCoordinate,
  type RouteEtaResult,
} from '@/shared/routing/routing.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapDriver, mapDriverLocation } from './drivers.mapper'

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly realtime: AdminRealtimeService,
  ) {}

  async listDrivers() {
    const memberships = await this.prisma.storeUser.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'driver',
      },
      include: {
        user: true,
        driverProfile: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
    const driverIds = memberships.map((membership) => membership.userId)
    const orders = await this.prisma.order.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId: {
          in: driverIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId: {
          in: driverIds,
        },
      },
      orderBy: {
        finalSequence: 'asc',
      },
    })

    return buildListResponse(
      memberships.map((membership) =>
        mapDriver({
          membership,
          orders: orders.filter((order) => order.driverId === membership.userId),
          assignments: assignments.filter(
            (assignment) => assignment.driverId === membership.userId,
          ),
        }),
      ),
      memberships.length,
    )
  }

  async getDriverById(driverId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'driver',
        userId: driverId,
      },
      include: {
        user: true,
        driverProfile: true,
      },
    })

    if (!membership) {
      throw new NotFoundException('Motoboy nao encontrado.')
    }

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
      },
      orderBy: {
        finalSequence: 'asc',
      },
    })

    return {
      data: mapDriver({ membership, orders, assignments }),
    }
  }

  async createDriver(payload: SaveDriverPayload) {
    const { driver } = payload

    const created = await this.prisma.user.create({
      data: {
        id: driver.id,
        name: driver.name,
        email: driver.email.trim().toLowerCase(),
        phone: driver.phone,
        passwordHash: 'pending-reset',
        status: driver.active ? 'active' : 'inactive',
        stores: {
          create: {
            storeId: DEFAULT_STORE_ID,
            role: 'driver',
            active: driver.active,
            driverProfile: {
              create: {
                vehicle: driver.vehicle,
                active: driver.active,
                availability: driver.active ? driver.availability : 'paused',
                lastActivityAt: new Date(),
              },
            },
          },
        },
      },
      include: {
        stores: {
          include: {
            user: true,
            driverProfile: true,
          },
        },
      },
    })

    const membership = created.stores[0]

    return {
      data: mapDriver({ membership, orders: [] }),
    }
  }

  async updateDriver(driverId: string, payload: SaveDriverPayload) {
    const { driver } = payload
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'driver',
        userId: driverId,
      },
      include: {
        driverProfile: true,
      },
    })

    if (!membership) {
      throw new NotFoundException('Motoboy nao encontrado.')
    }

    await this.prisma.user.update({
      where: {
        id: driverId,
      },
      data: {
        name: driver.name,
        email: driver.email.trim().toLowerCase(),
        phone: driver.phone,
        status: driver.active ? 'active' : 'inactive',
      },
    })

    await this.prisma.storeUser.update({
      where: {
        storeId_userId: {
          storeId: DEFAULT_STORE_ID,
          userId: driverId,
        },
      },
      data: {
        active: driver.active,
        driverProfile: {
          upsert: {
            update: {
              vehicle: driver.vehicle,
              active: driver.active,
              availability: driver.active ? driver.availability : 'paused',
              lastActivityAt: new Date(),
            },
            create: {
              vehicle: driver.vehicle,
              active: driver.active,
              availability: driver.active ? driver.availability : 'paused',
              lastActivityAt: new Date(),
            },
          },
        },
      },
    })

    return this.getDriverById(driverId)
  }

  async listActiveLocations() {
    const locations = await this.prisma.driverLocation.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        isActive: true,
      },
      orderBy: {
        capturedAt: 'desc',
      },
    })

    return buildListResponse(locations.map(mapDriverLocation), locations.length)
  }

  streamOperationalFeed(): Observable<MessageEvent> {
    return this.realtime.stream()
  }

  async getDriverLocation(driverId: string) {
    await this.findDriverMembership(driverId)

    const location = await this.prisma.driverLocation.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
      },
      orderBy: [
        {
          isActive: 'desc',
        },
        {
          capturedAt: 'desc',
        },
      ],
    })

    return {
      data: location ? mapDriverLocation(location) : null,
    }
  }

  async saveDriverLocation(driverId: string, payload: SaveDriverLocationPayload) {
    const membership = await this.findDriverMembership(driverId)
    const profile = membership.driverProfile

    if (!profile) {
      throw new BadRequestException('Motoboy sem perfil operacional.')
    }

    const capturedAt = payload.capturedAt ? new Date(payload.capturedAt) : new Date()

    if (Number.isNaN(capturedAt.getTime())) {
      throw new BadRequestException('Data de captura invalida.')
    }

    const trackingContext = await this.resolveActiveTrackingContext(driverId, payload)

    const location = await this.prisma.$transaction(async (transaction) => {
      await transaction.driverLocation.updateMany({
        where: {
          storeId: DEFAULT_STORE_ID,
          driverId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })

      const created = await transaction.driverLocation.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          driverId,
          driverProfileId: profile.id,
          orderId: trackingContext.orderId,
          assignmentId: trackingContext.assignmentId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          speedKmh:
            payload.speedKmh ??
            (trackingContext.previousLocation
              ? estimateSpeedKmh(
                  driverLocationToCoordinate(trackingContext.previousLocation),
                  { latitude: payload.latitude, longitude: payload.longitude },
                  trackingContext.previousLocation.capturedAt,
                  capturedAt,
                )
              : 0),
          heading: payload.heading ?? 0,
          accuracyMeters: payload.accuracyMeters ?? 25,
          source: payload.source,
          capturedAt,
          isActive: true,
        },
      })

      await transaction.driverProfile.update({
        where: {
          id: profile.id,
        },
        data: {
          availability: 'delivering',
          lastActivityAt: capturedAt,
        },
      })

      return created
    })

    const mappedLocation = mapDriverLocation(location)

    this.realtime.emit('driver.location_updated', {
      driverId,
      location: mappedLocation,
    })

    return {
      data: mappedLocation,
    }
  }

  async simulateDriverLocation(driverId: string, payload: SimulateDriverLocationPayload) {
    const current = await this.prisma.driverLocation.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        isActive: true,
      },
      orderBy: {
        capturedAt: 'desc',
      },
    })
    const route = await this.getDriverRoute(driverId)
    const nextCoordinate =
      payload.latitude !== undefined && payload.longitude !== undefined
        ? {
            latitude: payload.latitude,
            longitude: payload.longitude,
          }
        : getNextSimulatedCoordinate(
            current ? driverLocationToCoordinate(current) : route.data.storeLocation,
            route.data.geometry,
          )

    return this.saveDriverLocation(driverId, {
      latitude: nextCoordinate.latitude,
      longitude: nextCoordinate.longitude,
      speedKmh: payload.speedKmh ?? 28,
      heading: current
        ? calculateHeading(driverLocationToCoordinate(current), nextCoordinate)
        : 80,
      accuracyMeters: 18,
      source: 'simulator',
      capturedAt: new Date().toISOString(),
    })
  }

  async getDriverTrackingPolicy(driverId: string) {
    const membership = await this.findDriverMembership(driverId)
    const activeOrders = await this.getActiveDeliveryOrders(driverId)

    return {
      data: {
        driverId,
        trackingEnabled:
          membership.active &&
          membership.user.status === 'active' &&
          membership.driverProfile?.active === true &&
          membership.driverProfile.availability === 'delivering' &&
          activeOrders.length > 0,
        intervalSeconds: 60,
        minDistanceMeters: 35,
        reason:
          activeOrders.length > 0
            ? 'Entrega ativa em rota.'
            : 'Sem entrega ativa para rastreamento automatico.',
        currentOrderId: activeOrders[0]?.id ?? null,
      },
    }
  }

  async getDriverRoute(driverId: string) {
    const context = await this.getDriverRouteContext(driverId)
    const sortedOrders = sortOrdersByAssignment(context.orders, context.assignments)
    const response = await this.buildDriverRouteResponse({
      context,
      orders: sortedOrders,
    })

    await this.persistEtaSnapshots({
      storeId: DEFAULT_STORE_ID,
      driverId,
      origin: response.origin,
      route: response.route,
      stops: response.data.stops,
    })

    return {
      data: response.data,
    }
  }

  async getDispatchCandidates(driverId: string) {
    await this.findDriverMembership(driverId)

    const [store, routeResponse, readyOrders] = await Promise.all([
      this.getStore(),
      this.getDriverRoute(driverId),
      this.prisma.order.findMany({
        where: {
          storeId: DEFAULT_STORE_ID,
          source: 'delivery',
          status: 'ready',
        },
        orderBy: [
          {
            priority: 'desc',
          },
          {
            createdAt: 'asc',
          },
        ],
      }),
    ])

    const storeLocation = storeToCoordinate(store)
    const origin = routeResponse.data.currentLocation
      ? {
          latitude: routeResponse.data.currentLocation.latitude,
          longitude: routeResponse.data.currentLocation.longitude,
        }
      : routeResponse.data.storeLocation
    const activeStopsCoordinates = routeResponse.data.stops.map((stop, index) => ({
      latitude: stop.latitude ?? fallbackCoordinateFromText(`${stop.orderId}-${stop.addressLabel}`, index).latitude,
      longitude:
        stop.longitude ?? fallbackCoordinateFromText(`${stop.orderId}-${stop.addressLabel}`, index).longitude,
    }))
    const currentDurationSeconds = routeResponse.data.durationSeconds

    const candidates = await Promise.all(
      readyOrders.map(async (order, index) => {
        const destination = this.resolveOrderCoordinate(order, index)
        const fromStoreRoute = await calculateRouteEta([storeLocation, destination])
        const insertionPlans = activeStopsCoordinates.length
          ? await Promise.all(
              Array.from({ length: activeStopsCoordinates.length + 1 }, async (_, insertIndex) => {
                const route = await calculateRouteEta([
                  origin,
                  ...activeStopsCoordinates.slice(0, insertIndex),
                  destination,
                  ...activeStopsCoordinates.slice(insertIndex),
                ])

                return { insertIndex, route }
              }),
            )
          : []

        const bestPlan =
          insertionPlans.reduce<{ insertIndex: number; route: RouteEtaResult } | null>(
            (best, current) => {
              if (!best || current.route.durationSeconds < best.route.durationSeconds) {
                return current
              }

              return best
            },
            null,
          ) ?? {
            insertIndex: 0,
            route: fromStoreRoute,
          }

        const addedEtaMinutes = activeStopsCoordinates.length
          ? Math.max(0, Math.round((bestPlan.route.durationSeconds - currentDurationSeconds) / 60))
          : Math.max(1, Math.round(fromStoreRoute.durationSeconds / 60))

        return {
          orderId: order.id,
          orderNumber: order.number,
          customerName: order.customerName,
          addressLabel: order.addressLabel ?? order.addressText ?? 'Entrega',
          addressText: order.addressText ?? undefined,
          source: order.source,
          total: order.total.toNumber(),
          priority: order.priority,
          distanceFromStoreMeters: Math.round(fromStoreRoute.distanceMeters),
          etaFromStoreMinutes: Math.max(1, Math.round(fromStoreRoute.durationSeconds / 60)),
          addedEtaMinutes,
          routeEtaAfterAssignmentMinutes: Math.max(
            1,
            Math.round(bestPlan.route.durationSeconds / 60),
          ),
          bestInsertionSequence: bestPlan.insertIndex + 1,
          suggested: false,
          suggestionLabel: buildDispatchSuggestionLabel({
            hasActiveRoute: activeStopsCoordinates.length > 0,
            addedEtaMinutes,
            insertionSequence: bestPlan.insertIndex + 1,
          }),
        }
      }),
    )

    const sortedCandidates = candidates
      .slice()
      .sort((left, right) => {
        if (left.addedEtaMinutes !== right.addedEtaMinutes) {
          return left.addedEtaMinutes - right.addedEtaMinutes
        }

        if (left.etaFromStoreMinutes !== right.etaFromStoreMinutes) {
          return left.etaFromStoreMinutes - right.etaFromStoreMinutes
        }

        return getPriorityWeight(left.priority) - getPriorityWeight(right.priority)
      })
      .map((candidate, index) => ({
        ...candidate,
        suggested: index === 0,
        suggestionLabel:
          index === 0
            ? activeStopsCoordinates.length
              ? `Melhor encaixe operacional: +${candidate.addedEtaMinutes} min`
              : 'Melhor proximo pedido por proximidade'
            : candidate.suggestionLabel,
      }))

    return {
      data: sortedCandidates,
    }
  }

  async previewRoute(driverId: string, payload: PreviewDriverRoutePayload) {
    const context = await this.getDriverRouteContext(driverId)
    const currentOrders = sortOrdersByAssignment(context.orders, context.assignments)
    const currentRouteResponse = await this.buildDriverRouteResponse({
      context,
      orders: currentOrders,
    })
    const previewOrders = await this.resolvePreviewOrders(payload, currentOrders)
    const previewRouteResponse = await this.buildDriverRouteResponse({
      context,
      orders: previewOrders,
      previewOrderId: payload.previewOrderId,
    })
    const addedEtaMinutes = Math.max(
      0,
      Math.round(
        (previewRouteResponse.data.durationSeconds - currentRouteResponse.data.durationSeconds) /
          60,
      ),
    )
    const addedDistanceMeters = Math.max(
      0,
      previewRouteResponse.data.distanceMeters - currentRouteResponse.data.distanceMeters,
    )
    const severity = this.resolveImpactSeverity(addedEtaMinutes)
    const routeCompatibilityScore = this.buildRouteCompatibilityScore({
      addedEtaMinutes,
      addedDistanceMeters,
      stopCount: previewRouteResponse.data.stops.length,
    })

    return {
      data: {
        driverId,
        previewOrderId: payload.previewOrderId ?? null,
        insertedSequence: payload.previewOrderId
          ? this.resolvePreviewInsertionSequence(previewOrders, payload.previewOrderId)
          : null,
        severity,
        addedEtaMinutes,
        addedDistanceMeters,
        routeCompatibilityScore,
        recommendation: buildPreviewRecommendation({
          severity,
          addedEtaMinutes,
          addedDistanceMeters,
          hasCurrentRoute: currentOrders.length > 0,
        }),
        currentRoute: currentRouteResponse.data,
        previewRoute: previewRouteResponse.data,
      },
    }
  }

  async updateQueue(driverId: string, payload: UpdateDriverQueuePayload) {
    const context = await this.getDriverRouteContext(driverId)
    const currentOrders = sortOrdersByAssignment(context.orders, context.assignments)
    const currentOrderIds = currentOrders.map((order) => order.id)
    const incomingOrderIds = payload.orderIds

    if (
      currentOrderIds.length !== incomingOrderIds.length ||
      currentOrderIds.some((orderId) => !incomingOrderIds.includes(orderId))
    ) {
      throw new BadRequestException(
        'A nova ordem da rota precisa conter exatamente os pedidos ativos do motoboy.',
      )
    }

    await this.prisma.$transaction(
      incomingOrderIds.map((orderId, index) =>
        this.prisma.deliveryAssignment.updateMany({
          where: {
            storeId: DEFAULT_STORE_ID,
            driverId,
            orderId,
            status: 'active',
          },
          data: {
            finalSequence: index + 1,
          },
        }),
      ),
    )

    this.realtime.emit('driver.queue_updated', {
      driverId,
      reason: 'manual-reorder',
    })

    return this.getDriverById(driverId)
  }

  async getDriverAppState(driverId: string) {
    const [driverResponse, locationResponse, routeResponse, trackingPolicyResponse] =
      await Promise.all([
        this.getDriverById(driverId),
        this.getDriverLocation(driverId),
        this.getDriverRoute(driverId),
        this.getDriverTrackingPolicy(driverId),
      ])

    const currentStop = routeResponse.data.stops[0] ?? null
    const currentOrder = currentStop
      ? await this.prisma.order.findFirst({
          where: {
            id: currentStop.orderId,
            storeId: DEFAULT_STORE_ID,
          },
          include: {
            items: true,
          },
        })
      : null

    return {
      data: {
        driver: driverResponse.data,
        currentLocation: locationResponse.data,
        trackingPolicy: trackingPolicyResponse.data,
        route: routeResponse.data,
        currentDelivery: currentOrder
          ? {
              assignmentId: currentStop?.id ?? null,
              orderId: currentOrder.id,
              orderNumber: currentOrder.number,
              customerName: currentOrder.customerName,
              customerPhone: currentOrder.customerPhone,
              addressLabel: currentOrder.addressLabel ?? currentOrder.addressText ?? 'Entrega',
              addressText: currentOrder.addressText ?? '',
              source: currentOrder.source,
              status: currentOrder.status,
              paymentMethod: currentOrder.paymentMethod,
              total: currentOrder.total.toNumber(),
              etaMinutes: currentStop?.etaMinutes ?? routeResponse.data.etaMinutes,
              distanceMeters:
                currentStop?.distanceMeters ?? routeResponse.data.distanceMeters,
              notes: currentOrder.notes ?? '',
              itemCount: currentOrder.items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              ),
              items: currentOrder.items.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                notes: item.notes ?? '',
              })),
            }
          : null,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  async updateOwnAvailability(
    driverId: string,
    payload: UpdateDriverAvailabilityPayload,
  ) {
    const membership = await this.findDriverMembership(driverId)

    if (!membership.driverProfile) {
      throw new BadRequestException('Motoboy sem perfil operacional.')
    }

    const activeOrders = await this.getActiveDeliveryOrders(driverId)

    if (payload.availability === 'delivering' && activeOrders.length === 0) {
      throw new BadRequestException(
        'Nao existe entrega ativa para iniciar o rastreamento.',
      )
    }

    if (payload.availability === 'available' && activeOrders.length > 0) {
      throw new BadRequestException(
        'Finalize ou pause a entrega ativa antes de voltar para disponivel.',
      )
    }

    await this.prisma.driverProfile.update({
      where: {
        storeUserId: membership.id,
      },
      data: {
        availability: payload.availability,
        lastActivityAt: new Date(),
      },
    })

    this.realtime.emit('driver.status_updated', {
      driverId,
      availability: payload.availability,
      currentOrderId: activeOrders[0]?.id ?? null,
    })

    return this.getDriverAppState(driverId)
  }

  async startCurrentDelivery(driverId: string) {
    return this.updateOwnAvailability(driverId, {
      availability: 'delivering',
    })
  }

  async completeCurrentDelivery(driverId: string) {
    const membership = await this.findDriverMembership(driverId)
    const activeAssignments = await this.getActiveAssignmentsForDriver(driverId)
    const currentAssignment = activeAssignments[0]

    if (!currentAssignment) {
      throw new BadRequestException('Nao existe entrega ativa para finalizar.')
    }

    await this.prisma.deliveryAssignment.update({
      where: {
        id: currentAssignment.id,
      },
      data: {
        actualSequence:
          currentAssignment.actualSequence ?? currentAssignment.finalSequence,
      },
    })

    await this.ordersService.updateStatus(currentAssignment.orderId, {
      action: 'complete',
      actor: membership.user.name,
    })

    this.realtime.emit('driver.queue_updated', {
      driverId,
      reason: 'delivery-completed',
    })

    return this.getDriverAppState(driverId)
  }

  private async findDriverMembership(driverId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'driver',
        userId: driverId,
      },
      include: {
        user: true,
        driverProfile: true,
      },
    })

    if (!membership) {
      throw new NotFoundException('Motoboy nao encontrado.')
    }

    return membership
  }

  private async getStore() {
    return this.prisma.store.findUniqueOrThrow({
      where: {
        id: DEFAULT_STORE_ID,
      },
    })
  }

  private async getActiveDeliveryOrders(driverId: string) {
    return this.prisma.order.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        source: 'delivery',
        status: 'out_for_delivery',
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
  }

  private async getActiveAssignmentsForDriver(driverId: string) {
    return this.prisma.deliveryAssignment.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        status: 'active',
        order: {
          status: 'out_for_delivery',
        },
      },
      include: {
        order: true,
      },
      orderBy: {
        finalSequence: 'asc',
      },
    })
  }

  private async ensureAssignmentsForOrders(
    driverId: string,
    storeUserId: string,
    orders: Order[],
  ) {
    const existingAssignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        orderId: {
          in: orders.map((order) => order.id),
        },
        status: 'active',
      },
      orderBy: {
        finalSequence: 'asc',
      },
    })
    const missingOrders = orders.filter(
      (order) => !existingAssignments.some((assignment) => assignment.orderId === order.id),
    )

    if (!missingOrders.length) {
      return existingAssignments
    }

    const nextStartSequence =
      existingAssignments.reduce(
        (max, assignment) => Math.max(max, assignment.finalSequence),
        0,
      ) + 1

    await this.prisma.deliveryAssignment.createMany({
      data: missingOrders.map((order, index) => ({
        storeId: DEFAULT_STORE_ID,
        orderId: order.id,
        driverId,
        storeUserId,
        plannedSequence: nextStartSequence + index,
        finalSequence: nextStartSequence + index,
        status: 'active',
        assignedAt: order.updatedAt,
      })),
      skipDuplicates: true,
    })

    return this.prisma.deliveryAssignment.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        orderId: {
          in: orders.map((order) => order.id),
        },
        status: 'active',
      },
      orderBy: {
        finalSequence: 'asc',
      },
    })
  }

  private resolveOrderCoordinate(order: Order, index: number): GeoCoordinate {
    if (order.deliveryLatitude && order.deliveryLongitude) {
      return {
        latitude: order.deliveryLatitude.toNumber(),
        longitude: order.deliveryLongitude.toNumber(),
      }
    }

    return fallbackCoordinateFromText(
      `${order.id}-${order.addressLabel ?? ''}-${order.addressText ?? ''}`,
      index,
    )
  }

  private applyEtaToStops<TStop extends GeoCoordinate & { orderId: string; etaMinutes: number }>(
    origin: GeoCoordinate,
    stops: TStop[],
    route: RouteEtaResult,
  ) {
    const waypointDistances = [origin, ...stops].slice(1).map((point, index, waypoints) => {
      const previous = index === 0 ? origin : waypoints[index - 1]
      return estimatePolylineDistance([previous, point])
    })
    const totalWaypointDistance = waypointDistances.reduce((sum, distance) => sum + distance, 0)
    let accumulatedDistance = 0

    return stops.map((stop, index) => {
      accumulatedDistance += waypointDistances[index] ?? 0
      const ratio = totalWaypointDistance > 0 ? accumulatedDistance / totalWaypointDistance : 1

      return {
        ...stop,
        etaMinutes: Math.max(1, Math.round((route.durationSeconds * ratio) / 60)),
        distanceMeters: Math.round(accumulatedDistance),
      }
    })
  }

  private async persistEtaSnapshots(params: {
    storeId: string
    driverId: string
    origin: GeoCoordinate
    route: RouteEtaResult
    stops: Array<GeoCoordinate & { orderId: string; etaMinutes: number }>
  }) {
    if (!params.stops.length) {
      return
    }

    await this.prisma.etaSnapshot.createMany({
      data: params.stops.map((stop) => ({
        storeId: params.storeId,
        orderId: stop.orderId,
        driverId: params.driverId,
        provider: params.route.provider,
        etaMinutes: stop.etaMinutes,
        durationSeconds: Math.round(params.route.durationSeconds),
        distanceMeters: Math.round(params.route.distanceMeters),
        fromLatitude: params.origin.latitude,
        fromLongitude: params.origin.longitude,
        toLatitude: stop.latitude,
        toLongitude: stop.longitude,
        routeGeometry: routeGeometryToJson(params.route.geometry),
        message: 'ETA operacional calculado para despacho.',
      })),
    })
  }

  private async resolveActiveTrackingContext(
    driverId: string,
    payload: SaveDriverLocationPayload,
  ) {
    const membership = await this.findDriverMembership(driverId)
    const activeAssignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        status: 'active',
        order: {
          status: 'out_for_delivery',
        },
      },
      include: {
        order: true,
      },
      orderBy: {
        finalSequence: 'asc',
      },
    })

    if (
      !membership.active ||
      membership.user.status !== 'active' ||
      membership.driverProfile?.active !== true ||
      membership.driverProfile.availability !== 'delivering' ||
      activeAssignments.length === 0 ||
      payload.status === 'available' ||
      payload.status === 'paused'
    ) {
      throw new BadRequestException(
        'Tracking automatico permitido apenas para motoboy em entrega ativa.',
      )
    }

    const selectedAssignment =
      activeAssignments.find((assignment) => assignment.id === payload.currentAssignmentId) ??
      activeAssignments.find((assignment) => assignment.orderId === payload.currentOrderId) ??
      activeAssignments[0]
    const previousLocation = await this.prisma.driverLocation.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        driverId,
        isActive: true,
      },
      orderBy: {
        capturedAt: 'desc',
      },
    })

    return {
      orderId: selectedAssignment.orderId,
      assignmentId: selectedAssignment.id,
      previousLocation,
    }
  }

  private async getDriverRouteContext(driverId: string) {
    const membership = await this.findDriverMembership(driverId)
    const [store, location, orders] = await Promise.all([
      this.getStore(),
      this.prisma.driverLocation.findFirst({
        where: {
          storeId: DEFAULT_STORE_ID,
          driverId,
          isActive: true,
        },
        orderBy: {
          capturedAt: 'desc',
        },
      }),
      this.getActiveDeliveryOrders(driverId),
    ])
    const assignments = await this.ensureAssignmentsForOrders(
      driverId,
      membership.id,
      orders,
    )

    return {
      membership,
      store,
      location,
      orders,
      assignments,
    }
  }

  private async buildDriverRouteResponse(params: {
    context: Awaited<ReturnType<DriversService['getDriverRouteContext']>>
    orders: Order[]
    previewOrderId?: string
  }) {
    const { context, orders, previewOrderId } = params
    const origin = context.location
      ? driverLocationToCoordinate(context.location)
      : storeToCoordinate(context.store)
    const assignmentByOrderId = new Map(
      context.assignments.map((assignment) => [assignment.orderId, assignment]),
    )
    const stops = orders.map((order, index) => {
      const assignment = assignmentByOrderId.get(order.id)
      const coordinate = this.resolveOrderCoordinate(order, index)

      return {
        id: assignment?.id,
        orderId: order.id,
        orderNumber: order.number,
        customerName: order.customerName,
        addressLabel: order.addressLabel ?? order.addressText ?? 'Entrega',
        plannedSequence: assignment?.plannedSequence ?? index + 1,
        finalSequence: index + 1,
        actualSequence: assignment?.actualSequence ?? undefined,
        etaMinutes: 0,
        distanceMeters: 0,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        status: order.status,
        tags: previewOrderId === order.id ? ['preview'] : undefined,
      }
    })
    const route = await calculateRouteEta([origin, ...stops])
    const stopsWithEta = this.applyEtaToStops(origin, stops, route)
    const data = {
      driverId: context.membership.userId,
      driverName: context.membership.user.name,
      storeLocation: storeToCoordinate(context.store),
      currentLocation: context.location ? mapDriverLocation(context.location) : null,
      stops: stopsWithEta,
      geometry: route.geometry,
      etaMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
      durationSeconds: Math.round(route.durationSeconds),
      distanceMeters: Math.round(route.distanceMeters),
      provider: route.provider,
      updatedAt: new Date().toISOString(),
    }

    return {
      data,
      route,
      origin,
    }
  }

  private async resolvePreviewOrders(
    payload: PreviewDriverRoutePayload,
    currentOrders: Order[],
  ) {
    let orderedOrders = currentOrders

    if (payload.proposedOrderIds?.length) {
      const currentOrderMap = new Map(currentOrders.map((order) => [order.id, order]))
      orderedOrders = payload.proposedOrderIds.map((orderId) => {
        const order = currentOrderMap.get(orderId)

        if (!order) {
          throw new BadRequestException(
            'A pre-visualizacao recebeu um pedido que nao esta na rota ativa.',
          )
        }

        return order
      })
    }

    if (!payload.previewOrderId) {
      return orderedOrders
    }

    const previewOrder = await this.prisma.order.findFirst({
      where: {
        id: payload.previewOrderId,
        storeId: DEFAULT_STORE_ID,
        source: 'delivery',
        status: 'ready',
      },
    })

    if (!previewOrder) {
      throw new NotFoundException('Pedido pronto nao encontrado para pre-visualizacao.')
    }

    if (orderedOrders.some((order) => order.id === previewOrder.id)) {
      return orderedOrders
    }

    const sequence = Math.min(
      Math.max(1, payload.insertionSequence ?? orderedOrders.length + 1),
      orderedOrders.length + 1,
    )

    return [
      ...orderedOrders.slice(0, sequence - 1),
      previewOrder,
      ...orderedOrders.slice(sequence - 1),
    ]
  }

  private resolveImpactSeverity(addedEtaMinutes: number) {
    if (addedEtaMinutes <= 5) {
      return 'low' as const
    }

    if (addedEtaMinutes <= 12) {
      return 'medium' as const
    }

    return 'high' as const
  }

  private buildRouteCompatibilityScore(params: {
    addedEtaMinutes: number
    addedDistanceMeters: number
    stopCount: number
  }) {
    const etaPenalty = params.addedEtaMinutes * 4
    const distancePenalty = Math.round(params.addedDistanceMeters / 350)
    const densityPenalty = Math.max(0, params.stopCount - 3) * 3

    return Math.max(10, Math.min(98, 100 - etaPenalty - distancePenalty - densityPenalty))
  }

  private resolvePreviewInsertionSequence(orders: Order[], previewOrderId: string) {
    const sequence = orders.findIndex((order) => order.id === previewOrderId)
    return sequence >= 0 ? sequence + 1 : null
  }
}

function buildDispatchSuggestionLabel(params: {
  hasActiveRoute: boolean
  addedEtaMinutes: number
  insertionSequence: number
}) {
  if (!params.hasActiveRoute) {
    return 'Melhor proximo pedido por proximidade'
  }

  if (params.insertionSequence === 1) {
    return `Combina com a rota atual · +${params.addedEtaMinutes} min`
  }

  return `Adicionar este pedido aumenta +${params.addedEtaMinutes} min`
}

function buildPreviewRecommendation(params: {
  severity: 'low' | 'medium' | 'high'
  addedEtaMinutes: number
  addedDistanceMeters: number
  hasCurrentRoute: boolean
}) {
  if (!params.hasCurrentRoute) {
    return 'Pedido de alta compatibilidade com saida imediata da loja.'
  }

  if (params.severity === 'low') {
    return `Impacto baixo: +${params.addedEtaMinutes} min e +${Math.round(params.addedDistanceMeters / 1000)} km.`
  }

  if (params.severity === 'medium') {
    return `Impacto moderado: revisar SLA antes de confirmar o encaixe.`
  }

  return 'Impacto alto na rota atual. Considere outro motoboy ou reordenar as paradas.'
}

function getPriorityWeight(priority: Order['priority']) {
  if (priority === 'vip') {
    return 0
  }

  if (priority === 'priority') {
    return 1
  }

  return 2
}

function sortOrdersByAssignment(orders: Order[], assignments: DeliveryAssignment[]) {
  return orders.slice().sort((left, right) => {
    const leftAssignment = assignments.find((assignment) => assignment.orderId === left.id)
    const rightAssignment = assignments.find((assignment) => assignment.orderId === right.id)
    const leftSequence = leftAssignment?.finalSequence ?? Number.MAX_SAFE_INTEGER
    const rightSequence = rightAssignment?.finalSequence ?? Number.MAX_SAFE_INTEGER

    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence
    }

    return left.createdAt.getTime() - right.createdAt.getTime()
  })
}

function storeToCoordinate(store: Store): GeoCoordinate {
  return {
    latitude: store.latitude.toNumber(),
    longitude: store.longitude.toNumber(),
  }
}

function driverLocationToCoordinate(location: DriverLocation): GeoCoordinate {
  return {
    latitude: location.latitude.toNumber(),
    longitude: location.longitude.toNumber(),
  }
}

function fallbackCoordinateFromText(value: string, index: number): GeoCoordinate {
  const store = {
    latitude: -3.1019,
    longitude: -60.0217,
  }
  const seed = Math.abs(hashString(value))
  const angle = (seed % 360) * (Math.PI / 180)
  const radius = 0.009 + index * 0.003

  return {
    longitude: store.longitude + Math.cos(angle) * radius,
    latitude: store.latitude + Math.sin(angle) * radius * 0.72,
  }
}

function getNextSimulatedCoordinate(current: GeoCoordinate, geometry: GeoCoordinate[]) {
  if (geometry.length < 2) {
    return {
      latitude: current.latitude + 0.001,
      longitude: current.longitude + 0.001,
    }
  }

  const nearestIndex = geometry.reduce(
    (nearest, point, index) => {
      const distance = estimatePolylineDistance([current, point])
      return distance < nearest.distance ? { distance, index } : nearest
    },
    { distance: Number.POSITIVE_INFINITY, index: 0 },
  ).index
  const nextIndex = Math.min(geometry.length - 1, nearestIndex + 10)

  return geometry[nextIndex]
}

function calculateHeading(from: GeoCoordinate, to: GeoCoordinate) {
  const deltaLongitude = to.longitude - from.longitude
  const deltaLatitude = to.latitude - from.latitude
  const degrees = (Math.atan2(deltaLongitude, deltaLatitude) * 180) / Math.PI

  return (degrees + 360) % 360
}

function estimateSpeedKmh(
  from: GeoCoordinate,
  to: GeoCoordinate,
  fromAt: Date,
  toAt: Date,
) {
  const elapsedHours = Math.max(1 / 3600, (toAt.getTime() - fromAt.getTime()) / 3600000)
  const distanceKm = estimatePolylineDistance([from, to]) / 1000

  return Math.min(140, Math.max(0, Number((distanceKm / elapsedHours).toFixed(1))))
}

function hashString(value: string) {
  return value.split('').reduce((hash, char) => {
    return (hash << 5) - hash + char.charCodeAt(0)
  }, 0)
}

function routeGeometryToJson(geometry: GeoCoordinate[]): Prisma.InputJsonValue {
  return {
    coordinates: geometry.map((point) => [point.longitude, point.latitude]),
  } as Prisma.InputJsonValue
}
