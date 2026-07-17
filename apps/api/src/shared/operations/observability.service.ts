import { Injectable } from '@nestjs/common'

interface AreaMetrics {
  requests: number
  failures: number
  durationMs: number
}

@Injectable()
export class ObservabilityService {
  private startedAt = new Date()
  private requests = 0
  private failures = 0
  private conflicts = 0
  private activeRequests = 0
  private activeRealtimeConnections = 0
  private durationMs = 0
  private maxDurationMs = 0
  private readonly areas = new Map<string, AreaMetrics>()

  requestStarted() {
    this.activeRequests += 1
  }

  requestFinished(area: string, statusCode: number, durationMs: number) {
    this.activeRequests = Math.max(0, this.activeRequests - 1)
    this.requests += 1
    this.durationMs += durationMs
    this.maxDurationMs = Math.max(this.maxDurationMs, durationMs)
    if (statusCode >= 400) this.failures += 1
    if (statusCode === 409) this.conflicts += 1

    const current = this.areas.get(area) ?? { requests: 0, failures: 0, durationMs: 0 }
    current.requests += 1
    current.durationMs += durationMs
    if (statusCode >= 400) current.failures += 1
    this.areas.set(area, current)
  }

  realtimeOpened() {
    this.activeRealtimeConnections += 1
  }

  realtimeClosed() {
    this.activeRealtimeConnections = Math.max(0, this.activeRealtimeConnections - 1)
  }

  snapshot() {
    return {
      scope: 'local_process',
      startedAt: this.startedAt.toISOString(),
      requests: this.requests,
      failures: this.failures,
      conflicts: this.conflicts,
      activeRequests: this.activeRequests,
      activeRealtimeConnections: this.activeRealtimeConnections,
      averageDurationMs: this.requests ? Math.round(this.durationMs / this.requests) : 0,
      maxDurationMs: Math.round(this.maxDurationMs),
      areas: Object.fromEntries(
        [...this.areas.entries()].map(([area, metrics]) => [area, {
          requests: metrics.requests,
          failures: metrics.failures,
          averageDurationMs: metrics.requests
            ? Math.round(metrics.durationMs / metrics.requests)
            : 0,
        }]),
      ),
    }
  }
}
