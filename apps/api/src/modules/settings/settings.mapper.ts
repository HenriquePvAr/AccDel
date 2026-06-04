export function mapStoreSettings(store: {
  id: string
  name: string
  tradeName: string
  timezone: string
  city: string
  state: string
  brandAccent: string
  logoUrl: string | null
  phone: string | null
  publicWhatsapp: string | null
  addressLine: string | null
  neighborhood: string | null
  businessHours: string | null
  businessDays: string[]
  greetingMessage: string | null
  outOfHoursMessage: string | null
  cancellationPolicy: string | null
  generalNotes: string | null
  defaultDeliveryFee: { toNumber(): number }
  minimumOrderAmount: { toNumber(): number }
  deliveryEnabled: boolean
  pickupEnabled: boolean
  counterEnabled: boolean
  dineInEnabled: boolean
  digitalMenuEnabled: boolean
  whatsappAiEnabled: boolean
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
    logoUrl: store.logoUrl,
    phone: store.phone,
    publicWhatsapp: store.publicWhatsapp,
    addressLine: store.addressLine,
    neighborhood: store.neighborhood,
    businessHours: store.businessHours,
    businessDays: store.businessDays,
    greetingMessage: store.greetingMessage,
    outOfHoursMessage: store.outOfHoursMessage,
    cancellationPolicy: store.cancellationPolicy,
    generalNotes: store.generalNotes,
    defaultDeliveryFee: store.defaultDeliveryFee.toNumber(),
    minimumOrderAmount: store.minimumOrderAmount.toNumber(),
    deliveryEnabled: store.deliveryEnabled,
    pickupEnabled: store.pickupEnabled,
    counterEnabled: store.counterEnabled,
    dineInEnabled: store.dineInEnabled,
    digitalMenuEnabled: store.digitalMenuEnabled,
    whatsappAiEnabled: store.whatsappAiEnabled,
    autoAcceptEnabled: store.autoAcceptEnabled,
    estimatedPrepTimeMinutes: store.estimatedPrepTimeMinutes,
    estimatedDeliveryTimeMinutes: store.estimatedDeliveryTimeMinutes,
    estimatedDineInTimeMinutes: store.estimatedDineInTimeMinutes,
    estimatedCounterTimeMinutes: store.estimatedCounterTimeMinutes,
    estimatedPickupTimeMinutes: store.estimatedPickupTimeMinutes,
  }
}

export function mapDeliveryZone(zone: {
  id: string
  neighborhood: string
  fee: { toNumber(): number }
  active: boolean
  sortOrder: number
  estimatedDeliveryTimeMinutes: number | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: zone.id,
    neighborhood: zone.neighborhood,
    fee: zone.fee.toNumber(),
    active: zone.active,
    sortOrder: zone.sortOrder,
    estimatedDeliveryTimeMinutes: zone.estimatedDeliveryTimeMinutes,
    createdAt: zone.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
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
