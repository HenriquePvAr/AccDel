export function mapStoreSettings(store: {
  id: string
  name: string
  tradeName: string
  timezone: string
  city: string
  state: string
  brandAccent: string
  autoAcceptEnabled: boolean
  estimatedPrepTimeMinutes: number
  estimatedDeliveryTimeMinutes: number
  estimatedDineInTimeMinutes: number
  estimatedCounterTimeMinutes: number
  estimatedPickupTimeMinutes: number
}) {
  return {
    id: store.id,
    name: store.name,
    tradeName: store.tradeName,
    timezone: store.timezone,
    city: store.city,
    state: store.state,
    brandAccent: store.brandAccent,
    autoAcceptEnabled: store.autoAcceptEnabled,
    estimatedPrepTimeMinutes: store.estimatedPrepTimeMinutes,
    estimatedDeliveryTimeMinutes: store.estimatedDeliveryTimeMinutes,
    estimatedDineInTimeMinutes: store.estimatedDineInTimeMinutes,
    estimatedCounterTimeMinutes: store.estimatedCounterTimeMinutes,
    estimatedPickupTimeMinutes: store.estimatedPickupTimeMinutes,
  }
}

export function mapPaymentMethodConfig(config: {
  id: string
  name: string
  method: string | null
  provider: string
  active: boolean
  fixed: boolean
  requiresReceipt: boolean
  autoCashEntry: boolean
  channels: string[]
  sortOrder: number
  externalEnabled: boolean
  externalPaymentId: string | null
  qrCodePayload: string | null
  qrCodeUrl: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: config.id,
    name: config.name,
    method: config.method ?? undefined,
    provider: config.provider,
    active: config.active,
    fixed: config.fixed,
    requiresReceipt: config.requiresReceipt,
    autoCashEntry: config.autoCashEntry,
    channels: config.channels,
    sortOrder: config.sortOrder,
    externalEnabled: config.externalEnabled,
    externalPaymentId: config.externalPaymentId ?? undefined,
    qrCodePayload: config.qrCodePayload ?? undefined,
    qrCodeUrl: config.qrCodeUrl ?? undefined,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }
}
