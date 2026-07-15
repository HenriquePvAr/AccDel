import { Injectable } from '@nestjs/common'
import type { MessageEvent } from '@nestjs/common'
import { defer, filter, finalize, interval, map, merge, Observable, Subject } from 'rxjs'

import { ObservabilityService } from '@/shared/operations/observability.service'
import { getCurrentStoreId } from '@/shared/store-context'

export type AdminRealtimeEventName =
  | 'driver.location_updated'
  | 'driver.queue_updated'
  | 'driver.status_updated'
  | 'order.created'
  | 'order.status_changed'
  | 'dining.session_updated'
  | 'catalog.product_updated'

interface AdminRealtimePayloadMap {
  'driver.location_updated': {
    driverId: string
    location: Record<string, unknown>
  }
  'driver.queue_updated': {
    driverId: string
    reason?: string
  }
  'driver.status_updated': {
    driverId: string
    availability: string
    currentOrderId?: string | null
  }
  'order.created': {
    orderId: string
  }
  'order.status_changed': {
    orderId: string
    status: string
    driverId?: string | null
  }
  'dining.session_updated': {
    sessionId: string
    tableId: string
    reason: string
    fromTableId?: string
  }
  'catalog.product_updated': {
    productId: string
  }
}

interface AdminRealtimeEvent<TName extends AdminRealtimeEventName = AdminRealtimeEventName> {
  name: TName
  storeId: string
  occurredAt: string
  payload: AdminRealtimePayloadMap[TName]
}

@Injectable()
export class AdminRealtimeService {
  private readonly events$ = new Subject<AdminRealtimeEvent>()

  constructor(private readonly observability?: ObservabilityService) {}

  emit<TName extends AdminRealtimeEventName>(
    name: TName,
    payload: AdminRealtimePayloadMap[TName],
  ) {
    this.events$.next({
      name,
      storeId: getCurrentStoreId(),
      payload,
      occurredAt: new Date().toISOString(),
    })
  }

  stream(
    storeId = getCurrentStoreId(),
    allowedNames?: ReadonlySet<AdminRealtimeEventName>,
  ): Observable<MessageEvent> {
    return defer(() => {
      this.observability?.realtimeOpened()
      return merge(
        this.events$.pipe(
          filter(
            (event) => event.storeId === storeId && (!allowedNames || allowedNames.has(event.name)),
          ),
          map((event) => ({
            type: event.name,
            data: event,
          })),
        ),
        interval(20_000).pipe(
          map(() => ({
            type: 'ping',
            data: {
              occurredAt: new Date().toISOString(),
            },
          })),
        ),
      ).pipe(finalize(() => this.observability?.realtimeClosed()))
    })
  }
}
