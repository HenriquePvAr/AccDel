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
