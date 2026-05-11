export interface GeoCoordinate {
  latitude: number
  longitude: number
}

export type RouteProviderName = 'osrm' | 'valhalla' | 'fallback'

export interface RouteEtaResult {
  geometry: GeoCoordinate[]
  durationSeconds: number
  distanceMeters: number
  provider: RouteProviderName
}

interface OsrmRouteResponse {
  code: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: {
      coordinates: [number, number][]
    }
  }>
}

const osrmBaseUrl = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org'

export async function calculateRouteEta(waypoints: GeoCoordinate[]): Promise<RouteEtaResult> {
  const cleanWaypoints = waypoints.filter(isValidCoordinate)

  if (cleanWaypoints.length < 2) {
    return buildFallbackRoute(cleanWaypoints)
  }

  try {
    const coordinates = cleanWaypoints
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(';')
    const response = await fetch(
      `${osrmBaseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    )

    if (!response.ok) {
      throw new Error(`OSRM respondeu ${response.status}`)
    }

    const payload = (await response.json()) as OsrmRouteResponse
    const route = payload.routes?.[0]

    if (payload.code !== 'Ok' || !route) {
      throw new Error(payload.code || 'Rota indisponivel')
    }

    return {
      geometry: route.geometry.coordinates.map(([longitude, latitude]) => ({
        longitude,
        latitude,
      })),
      durationSeconds: route.duration,
      distanceMeters: route.distance,
      provider: 'osrm',
    }
  } catch {
    return buildFallbackRoute(cleanWaypoints)
  }
}

export function buildFallbackRoute(waypoints: GeoCoordinate[]): RouteEtaResult {
  const distanceMeters = estimatePolylineDistance(waypoints)

  return {
    geometry: waypoints,
    distanceMeters,
    durationSeconds: Math.max(60, Math.round((distanceMeters / 1000 / 28) * 3600)),
    provider: 'fallback',
  }
}

export function estimatePolylineDistance(waypoints: GeoCoordinate[]) {
  return waypoints.reduce((total, point, index) => {
    const previous = waypoints[index - 1]

    if (!previous) {
      return total
    }

    return total + haversineMeters(previous, point)
  }, 0)
}

export function haversineMeters(a: GeoCoordinate, b: GeoCoordinate) {
  const earthRadiusMeters = 6371000
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLon = toRadians(b.longitude - a.longitude)
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function isValidCoordinate(point: GeoCoordinate) {
  return (
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.longitude) <= 180 &&
    Math.abs(point.latitude) <= 90
  )
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
