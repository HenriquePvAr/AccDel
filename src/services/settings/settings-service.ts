import type {
  GetStoreSettingsResponse,
  ListDeliveryZonesResponse,
  ListPaymentMethodsResponse,
  SaveDeliveryZoneRequest,
  SaveDeliveryZoneResponse,
  SavePaymentMethodConfigRequest,
  SavePaymentMethodConfigResponse,
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

  async listPaymentMethods(): Promise<ListPaymentMethodsResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListPaymentMethodsResponse>('/settings/payments')
    }

    return simulateAsync({
      data: [
        {
          id: 'demo_pay_pix',
          name: 'Pix',
          method: 'pix',
          provider: 'pix',
          active: true,
          fixed: true,
          requiresReceipt: false,
          autoCashEntry: true,
          channels: ['delivery', 'counter', 'dine_in', 'digital_menu'],
          sortOrder: 1,
          externalEnabled: false,
        },
      ],
    })
  },

  async listDeliveryZones(): Promise<ListDeliveryZonesResponse> {
    if (shouldUseApi) {
      return apiClient.get<ListDeliveryZonesResponse>('/settings/delivery-zones')
    }

    return simulateAsync({ data: [] })
  },

  async saveDeliveryZone(
    request: SaveDeliveryZoneRequest,
  ): Promise<SaveDeliveryZoneResponse> {
    if (shouldUseApi) {
      const endpoint = request.id
        ? `/settings/delivery-zones/${request.id}`
        : '/settings/delivery-zones'
      const payload = {
        ...request,
        neighborhood: request.neighborhood.trim(),
      }

      return request.id
        ? apiClient.patch<SaveDeliveryZoneResponse, typeof payload>(endpoint, payload)
        : apiClient.post<SaveDeliveryZoneResponse, typeof payload>(endpoint, payload)
    }

    return simulateAsync({
      data: {
        id: request.id ?? crypto.randomUUID(),
        neighborhood: request.neighborhood.trim(),
        fee: request.fee,
        active: request.active,
        sortOrder: request.sortOrder ?? 0,
        estimatedDeliveryTimeMinutes: request.estimatedDeliveryTimeMinutes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  },

  async savePaymentMethod(
    request: SavePaymentMethodConfigRequest,
  ): Promise<SavePaymentMethodConfigResponse> {
    if (shouldUseApi) {
      const endpoint = request.id ? `/settings/payments/${request.id}` : '/settings/payments'
      const payload = {
        ...request,
        name: request.name.trim(),
      }

      return request.id
        ? apiClient.patch<SavePaymentMethodConfigResponse, typeof payload>(endpoint, payload)
        : apiClient.post<SavePaymentMethodConfigResponse, typeof payload>(endpoint, payload)
    }

    return simulateAsync({
      data: {
        id: request.id ?? crypto.randomUUID(),
        name: request.name.trim(),
        method: request.method ?? undefined,
        provider: request.provider,
        active: request.active,
        fixed: request.fixed ?? false,
        requiresReceipt: request.requiresReceipt,
        autoCashEntry: request.autoCashEntry,
        channels: request.channels,
        sortOrder: request.sortOrder,
        externalEnabled: request.externalEnabled ?? false,
      },
    })
  },
}
