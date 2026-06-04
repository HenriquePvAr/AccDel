import type { PaymentMethod, PaymentMethodConfig, PaymentProvider, ProductChannel, StoreProfile } from '@/types'

export interface GetStoreSettingsResponse {
  data: StoreProfile
}

export interface UpdateOperationalSettingsRequest {
  name?: string
  tradeName?: string
  logoUrl?: string | null
  phone?: string | null
  publicWhatsapp?: string | null
  addressLine?: string | null
  city?: string
  state?: string
  neighborhood?: string | null
  businessHours?: string | null
  businessDays?: string[]
  greetingMessage?: string | null
  outOfHoursMessage?: string | null
  cancellationPolicy?: string | null
  generalNotes?: string | null
  defaultDeliveryFee?: number
  minimumOrderAmount?: number
  deliveryEnabled?: boolean
  pickupEnabled?: boolean
  counterEnabled?: boolean
  dineInEnabled?: boolean
  digitalMenuEnabled?: boolean
  whatsappAiEnabled?: boolean
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

export interface DeliveryZoneConfig {
  id: string
  neighborhood: string
  fee: number
  active: boolean
  sortOrder: number
  estimatedDeliveryTimeMinutes: number | null
  createdAt: string
  updatedAt: string
}

export interface ListDeliveryZonesResponse {
  data: DeliveryZoneConfig[]
}

export interface SaveDeliveryZoneRequest {
  id?: string
  neighborhood: string
  fee: number
  active: boolean
  sortOrder?: number
  estimatedDeliveryTimeMinutes?: number | null
}

export interface SaveDeliveryZoneResponse {
  data: DeliveryZoneConfig
}
