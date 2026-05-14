import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/hooks/queries/query-keys'
import { usersService } from '@/services'

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users.list,
    queryFn: () => usersService.listUsers(),
  })
}
