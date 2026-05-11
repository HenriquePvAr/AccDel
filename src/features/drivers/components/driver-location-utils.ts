import { driverAvailabilityMeta } from '@/lib/domain'
import { formatRelative } from '@/lib/format'
import type { DeliveryStop, Driver, DriverLocation, DriverRoute, GeoCoordinate } from '@/types'

export const driverMapStoreCoordinate: GeoCoordinate = {
  longitude: -60.0217,
  latitude: -3.1019,
}

export const driverMapStoreLabel = 'Cain Burger House'

export type DriverStatusFilter = 'all' | 'delivering' | 'available' | 'paused' | 'offline'
export type DriverSortOption = 'default' | 'eta' | 'speed' | 'updated' | 'name'

export const driverStatusFilterOptions: Array<{
  value: DriverStatusFilter
  label: string
  dotClassName: string
}> = [
  { value: 'all', label: 'Todos', dotClassName: 'bg-primary' },
  { value: 'delivering', label: 'Em entrega', dotClassName: 'bg-sky-400' },
  { value: 'available', label: 'Disponiveis', dotClassName: 'bg-emerald-400' },
  { value: 'paused', label: 'Pausados', dotClassName: 'bg-amber-400' },
  { value: 'offline', label: 'Offline', dotClassName: 'bg-slate-500' },
]

export const driverSortOptions: Array<{
  value: DriverSortOption
  label: string
}> = [
  { value: 'default', label: 'Padrao' },
  { value: 'eta', label: 'Menor ETA' },
  { value: 'speed', label: 'Maior velocidade' },
  { value: 'updated', label: 'Ultima atualizacao' },
  { value: 'name', label: 'Nome' },
]

export function getDriverFilterBucket(driver: Driver): Exclude<DriverStatusFilter, 'all'> {
  if (driver.connectionStatus === 'offline') {
    return 'offline'
  }

  if (driver.availability === 'delivering') {
    return 'delivering'
  }

  if (driver.availability === 'paused') {
    return 'paused'
  }

  return 'available'
}

export function getDriverStatusLabel(driver: Driver) {
  const bucket = getDriverFilterBucket(driver)

  if (bucket === 'offline') {
    return 'Offline'
  }

  return driverAvailabilityMeta[driver.availability].label
}

export function matchesDriverFilter(driver: Driver, filter: DriverStatusFilter) {
  if (filter === 'all') {
    return true
  }

  return getDriverFilterBucket(driver) === filter
}

export function getDriverLocationCoordinate(location: DriverLocation): GeoCoordinate {
  return {
    longitude:
      location.longitude ?? driverMapStoreCoordinate.longitude + (location.x - 50) * 0.0012,
    latitude: location.latitude ?? driverMapStoreCoordinate.latitude - (location.y - 50) * 0.0009,
  }
}

export function getStopCoordinate(stop: DeliveryStop, index: number): GeoCoordinate {
  if (stop.longitude !== undefined && stop.latitude !== undefined) {
    return {
      longitude: stop.longitude,
      latitude: stop.latitude,
    }
  }

  const seed = hashString(`${stop.orderId}-${stop.addressLabel}-${stop.finalSequence}`)
  const angle = (seed % 360) * (Math.PI / 180)
  const radius = 0.008 + index * 0.0035

  return {
    longitude: driverMapStoreCoordinate.longitude + Math.cos(angle) * radius,
    latitude: driverMapStoreCoordinate.latitude + Math.sin(angle) * radius * 0.72,
  }
}

export function getPrimaryStop(driver: Driver, route?: DriverRoute | null) {
  const orderedStops = (route?.stops ?? driver.queue)
    .slice()
    .sort((left, right) => left.finalSequence - right.finalSequence)

  return orderedStops[0] ?? null
}

export function getSecondaryStop(driver: Driver, route?: DriverRoute | null) {
  const orderedStops = (route?.stops ?? driver.queue)
    .slice()
    .sort((left, right) => left.finalSequence - right.finalSequence)

  return orderedStops[1] ?? null
}

export function formatDistanceMeters(distanceMeters?: number | null) {
  if (distanceMeters === undefined || distanceMeters === null) {
    return '—'
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(distanceMeters / 1000)} km`
}

export function formatEtaMinutes(etaMinutes?: number | null) {
  if (etaMinutes === undefined || etaMinutes === null) {
    return '—'
  }

  return `${Math.max(0, Math.round(etaMinutes))} min`
}

export function formatSpeedKmh(speedKmh?: number | null) {
  return `${Math.max(0, Math.round(speedKmh ?? 0))} km/h`
}

export function formatDriverLastUpdate(location?: DriverLocation | null) {
  if (!location) {
    return 'Sem atualizacao'
  }

  return formatRelative(location.capturedAt)
}

function hashString(value: string) {
  return value.split('').reduce((hash, char) => {
    return (hash << 5) - hash + char.charCodeAt(0)
  }, 0)
}
