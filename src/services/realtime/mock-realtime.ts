import type { AdminRealtimeEvent, AdminRealtimeEventName, AdminRealtimePayloadMap } from './events'

type RealtimeListener = (event: AdminRealtimeEvent) => void

class MockRealtimeBus {
  private listeners = new Set<RealtimeListener>()

  emit<TName extends AdminRealtimeEventName>(
    name: TName,
    payload: AdminRealtimePayloadMap[TName],
  ) {
    const event: AdminRealtimeEvent<TName> = {
      name,
      payload,
      occurredAt: new Date().toISOString(),
    }

    for (const listener of this.listeners) {
      listener(event as AdminRealtimeEvent)
    }
  }

  subscribe(listener: RealtimeListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const mockRealtimeBus = new MockRealtimeBus()
