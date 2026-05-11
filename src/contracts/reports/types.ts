import type { OrderChannel, OrderStatus, ReportsSnapshot } from '@/types'

export interface ReportsFilters {
  period?: 'today' | '7d' | '30d'
  channel?: OrderChannel | 'all'
  status?: OrderStatus | 'all'
}

export interface GetReportsRequest {
  filters?: ReportsFilters
}

export interface GetReportsResponse {
  data: ReportsSnapshot
}
