import { useQuery } from '@tanstack/react-query'

import { readinessService } from '@/services/operations/readiness-service'

export function useReadinessQuery() {
  return useQuery({
    queryKey: ['operations', 'readiness'],
    queryFn: () => readinessService.get(),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
}
