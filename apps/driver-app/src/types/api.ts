export type DriverAvailabilityStatus = 'available' | 'delivering' | 'paused'
export type DriverConnectionStatus = 'online' | 'offline'
export type DriverLocationSource = 'gps' | 'app' | 'admin' | 'simulator' | 'fallback'
export type OrderStatus =
  | 'in_analysis'
  | 'in_preparation'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
export type OrderChannel =
  | 'delivery'
  | 'dine_in'
  | 'counter'
  | 'pickup'
  | 'digital_menu'
  | 'whatsapp'
export type PaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'meal_voucher'
  | 'payment_link'

export interface DriverSessionUser {
  id: string
  email: string
  name: string
  role: 'driver'
  status: 'active' | 'inactive'
  initials: string
  permissions: string[]
  store: {
    id: string
    name: string
    tradeName: string
  }
}

export interface LoginResponse {
  data: {
    accessToken: string
    user: DriverSessionUser
  }
}

export interface MeResponse {
  data: DriverSessionUser
}

export interface DeliveryStop {
  id?: string
  orderId: string
  orderNumber: string
  customerName: string
  addressLabel: string
  plannedSequence: number
  finalSequence: number
  actualSequence?: number
  etaMinutes: number
  distanceMeters?: number
  latitude?: number
  longitude?: number
  status?: OrderStatus
}

export interface DriverLocation {
  id: string
  driverId: string
  orderId?: string
  assignmentId?: string
  longitude?: number
  latitude?: number
  accuracyMeters?: number
  heading: number
  speedKmh: number
  capturedAt: string
  source?: DriverLocationSource
  isActive?: boolean
}

export interface DriverRoute {
  driverId: string
  driverName: string
  storeLocation: {
    latitude: number
    longitude: number
  }
  currentLocation: DriverLocation | null
  stops: DeliveryStop[]
  geometry: Array<{
    latitude: number
    longitude: number
  }>
  etaMinutes: number
  durationSeconds: number
  distanceMeters: number
  provider: 'osrm' | 'valhalla' | 'fallback'
  updatedAt: string
}

export interface DriverSummary {
  id: string
  name: string
  email?: string
  phone: string
  vehicle: string
  active?: boolean
  connectionStatus: DriverConnectionStatus
  availability: DriverAvailabilityStatus
  currentOrderId?: string
  averageDeliveryMinutes: number
  distanceKmToday: number
  totalDeliveries?: number
  completedOrders?: number
  cancelledOrders?: number
  totalAssignedRevenue?: number
  lastActivityAt?: string
  queue: DeliveryStop[]
}

export interface DriverTrackingPolicy {
  driverId: string
  trackingEnabled: boolean
  intervalSeconds: number
  minDistanceMeters: number
  reason: string
  currentOrderId: string | null
}

export interface DriverDeliveryItemSummary {
  id: string
  name: string
  quantity: number
  notes: string
}

export interface DriverCurrentDelivery {
  assignmentId: string | null
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  addressLabel: string
  addressText: string
  source: OrderChannel
  status: OrderStatus
  paymentMethod: PaymentMethod
  total: number
  etaMinutes: number
  distanceMeters: number
  notes: string
  itemCount: number
  items: DriverDeliveryItemSummary[]
}

export interface DriverAppState {
  driver: DriverSummary
  currentLocation: DriverLocation | null
  trackingPolicy: DriverTrackingPolicy
  route: DriverRoute
  currentDelivery: DriverCurrentDelivery | null
  updatedAt: string
}

export interface DriverAppStateResponse {
  data: DriverAppState
}

export interface UpdateDriverStatusRequest {
  availability: DriverAvailabilityStatus
}

export interface SendDriverLocationRequest {
  latitude: number
  longitude: number
  speedKmh?: number
  heading?: number
  accuracyMeters?: number
  capturedAt?: string
  source?: DriverLocationSource
  currentOrderId?: string
  currentAssignmentId?: string
}

export interface SendDriverLocationResponse {
  data: DriverLocation
}
