import { Injectable } from '@nestjs/common'
import type { MessageEvent } from '@nestjs/common'
import { interval, map, merge, Observable, Subject } from 'rxjs'

type AdminRealtimeEventName =
  | 'driver.location_updated'
  | 'driver.queue_updated'
  | 'driver.status_updated'
  | 'order.created'
  | 'order.status_changed'

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
}

interface AdminRealtimeEvent<TName extends AdminRealtimeEventName = AdminRealtimeEventName> {
  name: TName
  occurredAt: string
  payload: AdminRealtimePayloadMap[TName]
}

@Injectable()
export class AdminRealtimeService {
  private readonly events$ = new Subject<AdminRealtimeEvent>()

  emit<TName extends AdminRealtimeEventName>(
    name: TName,
    payload: AdminRealtimePayloadMap[TName],
  ) {
    this.events$.next({
      name,
      payload,
      occurredAt: new Date().toISOString(),
    })
  }

  stream(): Observable<MessageEvent> {
    return merge(
      this.events$.pipe(
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
    )
  }
}
