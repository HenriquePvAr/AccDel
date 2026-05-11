export interface GeoCoordinate {
  longitude: number
  latitude: number
}

export interface RouteEtaRequest {
  waypoints: GeoCoordinate[]
}

export interface RouteEtaResponse {
  geometry: GeoCoordinate[]
  durationSeconds: number
  distanceMeters: number
  provider: RouteProviderName
}

export type RouteProviderName = 'osrm' | 'valhalla' | 'fallback'

interface RouteProvider {
  name: RouteProviderName
  calculateRouteEta: (waypoints: GeoCoordinate[]) => Promise<RouteEtaResponse>
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

const routingProvider = import.meta.env.VITE_ROUTING_PROVIDER ?? 'osrm'
const osrmBaseUrl = import.meta.env.VITE_OSRM_BASE_URL ?? 'https://router.project-osrm.org'
const valhallaBaseUrl = import.meta.env.VITE_VALHALLA_BASE_URL

export const routingService = {
  async calculateRouteEta(request: RouteEtaRequest): Promise<RouteEtaResponse> {
    const cleanWaypoints = request.waypoints.filter(isValidCoordinate)

    if (cleanWaypoints.length < 2) {
      return fallbackRouteProvider.calculateRouteEta(cleanWaypoints)
    }

    return getRoutingProvider().calculateRouteEta(cleanWaypoints)
  },
}

const osrmRouteProvider: RouteProvider = {
  name: 'osrm',
  async calculateRouteEta(waypoints) {
    try {
      const coordinates = waypoints.map((point) => `${point.longitude},${point.latitude}`).join(';')
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
        provider: this.name,
      }
    } catch {
      return fallbackRouteProvider.calculateRouteEta(waypoints)
    }
  },
}

const valhallaRouteProvider: RouteProvider = {
  name: 'valhalla',
  async calculateRouteEta(waypoints) {
    if (!valhallaBaseUrl) {
      return fallbackRouteProvider.calculateRouteEta(waypoints)
    }

    // The Valhalla endpoint stays isolated here so the map component does not
    // care which routing engine produced the geometry/ETA.
    return fallbackRouteProvider.calculateRouteEta(waypoints)
  },
}

const fallbackRouteProvider: RouteProvider = {
  name: 'fallback',
  async calculateRouteEta(waypoints) {
    return buildFallbackRoute(waypoints)
  },
}

function getRoutingProvider() {
  if (routingProvider === 'valhalla') {
    return valhallaRouteProvider
  }

  return osrmRouteProvider
}

function isValidCoordinate(point: GeoCoordinate) {
  return (
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.longitude) <= 180 &&
    Math.abs(point.latitude) <= 90
  )
}

function buildFallbackRoute(waypoints: GeoCoordinate[]): RouteEtaResponse {
  const distanceMeters = estimatePolylineDistance(waypoints)

  return {
    geometry: waypoints,
    distanceMeters,
    durationSeconds: Math.max(60, Math.round((distanceMeters / 1000 / 28) * 3600)),
    provider: 'fallback',
  }
}

function estimatePolylineDistance(waypoints: GeoCoordinate[]) {
  return waypoints.reduce((total, point, index) => {
    const previous = waypoints[index - 1]

    if (!previous) {
      return total
    }

    return total + haversineMeters(previous, point)
  }, 0)
}

function haversineMeters(a: GeoCoordinate, b: GeoCoordinate) {
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

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
