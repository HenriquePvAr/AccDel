import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/hooks/queries/query-keys'
import { reportsService } from '@/services'
import type { ReportsFilters } from '@/contracts'

export function useReportsQuery(filters?: ReportsFilters) {
  return useQuery({
    queryKey: queryKeys.reports.snapshot(filters ?? {}),
    queryFn: () => reportsService.getSnapshot({ filters }),
  })
}
