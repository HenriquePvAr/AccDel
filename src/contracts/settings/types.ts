import type { StoreProfile } from '@/types'

export interface GetStoreSettingsResponse {
  data: StoreProfile
}

export interface UpdateOperationalSettingsRequest {
  autoAcceptEnabled?: boolean
  estimatedPrepTimeMinutes?: number
  estimatedDeliveryTimeMinutes?: number
  estimatedDineInTimeMinutes?: number
  estimatedCounterTimeMinutes?: number
  estimatedPickupTimeMinutes?: number
}

export interface UpdateOperationalSettingsResponse {
  data: StoreProfile
}
