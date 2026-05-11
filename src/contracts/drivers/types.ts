import type {
  DeliveryStop,
  Driver,
  DriverLocation,
  DriverRoute,
  OrderChannel,
  PriorityLevel,
} from '@/types'

import type { ListResponse } from '@/contracts/common'

export type ListDriversResponse = ListResponse<Driver>
export type ListDriverLocationsResponse = ListResponse<DriverLocation>

export interface GetDriverByIdRequest {
  driverId: string
}

export interface GetDriverByIdResponse {
  data: Driver
}

export interface SaveDriverRequest {
  driver: Omit<
    Pick<Driver, 'id' | 'name' | 'email' | 'phone' | 'vehicle' | 'availability'>,
    'id'
  > & {
    id?: string
    active: boolean
  }
}

export interface SaveDriverResponse {
  data: Driver
}

export interface UpdateDriverQueueRequest {
  driverId: string
  queue: DeliveryStop[]
}

export interface UpdateDriverQueueResponse {
  data: Driver
}

export type DriverRoutePreviewSeverity = 'low' | 'medium' | 'high'

export interface UpdateDriverLocationRequest {
  driverId: string
  x?: number
  y?: number
  longitude?: number
  latitude?: number
  speedKmh?: number
  heading?: number
  accuracyMeters?: number
  capturedAt?: string
  source?: DriverLocation['source']
  status?: Driver['availability']
  currentOrderId?: string
  currentAssignmentId?: string
}

export interface UpdateDriverLocationResponse {
  data: DriverLocation
}

export interface GetDriverRouteRequest {
  driverId: string
}

export interface GetDriverRouteResponse {
  data: DriverRoute
}

export interface DriverDispatchCandidate {
  orderId: string
  orderNumber: string
  customerName: string
  addressLabel: string
  addressText?: string
  source: OrderChannel
  total: number
  priority: PriorityLevel
  distanceFromStoreMeters: number
  etaFromStoreMinutes: number
  addedEtaMinutes: number
  routeEtaAfterAssignmentMinutes: number
  bestInsertionSequence: number
  suggested: boolean
  suggestionLabel: string
}

export interface DriverRoutePreviewRequest {
  driverId: string
  previewOrderId?: string
  insertionSequence?: number
  proposedOrderIds?: string[]
}

export interface DriverRoutePreviewResponse {
  data: {
    driverId: string
    previewOrderId?: string | null
    insertedSequence?: number | null
    severity: DriverRoutePreviewSeverity
    addedEtaMinutes: number
    addedDistanceMeters: number
    routeCompatibilityScore: number
    recommendation: string
    currentRoute: DriverRoute
    previewRoute: DriverRoute
  }
}

export interface GetDriverDispatchCandidatesRequest {
  driverId: string
}

export interface GetDriverDispatchCandidatesResponse {
  data: DriverDispatchCandidate[]
}
