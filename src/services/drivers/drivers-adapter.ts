import type { ListDriverLocationsResponse, ListDriversResponse } from '@/contracts'
import { buildListResponse } from '@/services/adapters/list-response'
import type { Driver, DriverLocation } from '@/types'

export function buildDriversResponse(drivers: Driver[]): ListDriversResponse {
  return buildListResponse(drivers)
}

export function buildDriverLocationsResponse(
  locations: DriverLocation[],
): ListDriverLocationsResponse {
  return buildListResponse(locations)
}
