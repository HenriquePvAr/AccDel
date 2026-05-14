import type { ListUsersResponse } from '@/contracts'
import { buildListResponse } from '@/services/adapters/list-response'
import { apiClient, shouldUseApi } from '@/services/http/api-client'
import { simulateAsync } from '@/services/utils'

export const usersService = {
  async listUsers(): Promise<ListUsersResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListUsersResponse>('/users')
    }

    return simulateAsync(buildListResponse([]))
  },
}
