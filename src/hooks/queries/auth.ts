import { useMutation, useQuery } from '@tanstack/react-query'

import type { LoginRequest } from '@/contracts/auth'
import { authService } from '@/services/auth/auth-service'
import { queryKeys } from '@/hooks/queries/query-keys'

export function useCurrentUserQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => authService.me(),
    enabled,
    retry: false,
  })
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (payload: LoginRequest) => authService.login(payload),
  })
}
