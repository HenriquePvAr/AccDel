import type { PaymentMethod, PaymentMethodConfig, PaymentProvider, ProductChannel, StoreProfile } from '@/types'

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

export interface ListPaymentMethodsResponse {
  data: PaymentMethodConfig[]
}

export interface SavePaymentMethodConfigRequest {
  id?: string
  name: string
  method?: PaymentMethod | null
  provider: PaymentProvider
  active: boolean
  fixed?: boolean
  requiresReceipt: boolean
  autoCashEntry: boolean
  channels: ProductChannel[]
  sortOrder: number
  externalEnabled?: boolean
}

export interface SavePaymentMethodConfigResponse {
  data: PaymentMethodConfig
}
