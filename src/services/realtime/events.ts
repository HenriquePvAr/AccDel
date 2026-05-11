export interface AdminRealtimePayloadMap {
  'order.created': { orderId: string }
  'order.updated': { orderId: string }
  'order.status_changed': { orderId: string; status: string; driverId?: string | null }
  'driver.location_updated': {
    driverId: string
    location: Record<string, unknown>
  }
  'driver.queue_updated': { driverId: string; reason?: string }
  'driver.status_updated': {
    driverId: string
    availability: string
    currentOrderId?: string | null
  }
  'cash.updated': { registerId: string }
  'catalog.product_updated': { productId: string }
  'dining.session_updated': { sessionId: string; tableId: string }
}

export type AdminRealtimeEventName = keyof AdminRealtimePayloadMap

export type AdminRealtimeEvent<TName extends AdminRealtimeEventName = AdminRealtimeEventName> =
  TName extends AdminRealtimeEventName
    ? {
        name: TName
        occurredAt: string
        payload: AdminRealtimePayloadMap[TName]
      }
    : never
