import type {
  GetStoreSettingsResponse,
  UpdateOperationalSettingsRequest,
  UpdateOperationalSettingsResponse,
} from '@/contracts'
import { apiClient, shouldUseApi } from '@/services/http/api-client'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import { simulateAsync } from '@/services/utils'

export const settingsService = {
  async getStoreSettings(): Promise<GetStoreSettingsResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetStoreSettingsResponse>('/settings/store')
    }

    return simulateAsync({ data: getDemoDatabase().store })
  },

  async updateOperationalSettings(
    request: UpdateOperationalSettingsRequest,
  ): Promise<UpdateOperationalSettingsResponse> {
    if (shouldUseApi) {
      return apiClient.patch<UpdateOperationalSettingsResponse, UpdateOperationalSettingsRequest>(
        '/settings/store/operational',
        request,
      )
    }

    const nextDb = mutateDemoDatabase((database) => ({
      ...database,
      store: {
        ...database.store,
        ...request,
      },
    }))

    return simulateAsync({ data: nextDb.store })
  },
}
