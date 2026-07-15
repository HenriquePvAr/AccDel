import { apiClient } from '@/services/http/api-client'

export interface ReadinessSnapshot {
  status: 'ready' | 'attention' | 'blocked'
  service: string
  version: string
  appEnvironment: string
  database: { reachable: boolean }
  migrations: { applied: number; expected: number; failed: number | null }
  queues?: {
    outbound: { pending: number; failed: number }
    printing: { pending: number; failed: number }
  }
  printingAgents?: { online: number; offline: number }
  operation?: { waitingHuman: number; delayedOrders: number }
  integrations?: {
    whatsapp: { enabled: boolean; provider: string; sandbox: boolean }
    ai: { enabled: boolean; provider: string }
  }
  features: Record<string, boolean>
  metrics: {
    scope: 'local_process'
    startedAt: string
    requests: number
    failures: number
    conflicts: number
    activeRequests: number
    activeRealtimeConnections: number
    averageDurationMs: number
    maxDurationMs: number
    areas: Record<string, {
      requests: number
      failures: number
      averageDurationMs: number
    }>
  }
  checkedAt: string
}

export const readinessService = {
  get() {
    return apiClient.get<ReadinessSnapshot>('/ready')
  },
}
