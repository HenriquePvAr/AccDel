import type {
  DriverAppStateResponse,
  SendDriverLocationRequest,
  SendDriverLocationResponse,
  UpdateDriverStatusRequest,
} from '../types/api'
import { apiClient, buildLocationPayload } from './client'

export const driverApi = {
  getAppState() {
    return apiClient.get<DriverAppStateResponse>('/drivers/me/app-state')
  },

  startDelivery() {
    return apiClient.post<DriverAppStateResponse>('/drivers/me/delivery/start')
  },

  completeDelivery() {
    return apiClient.post<DriverAppStateResponse>('/drivers/me/delivery/complete')
  },

  updateStatus(payload: UpdateDriverStatusRequest) {
    return apiClient.patch<DriverAppStateResponse, UpdateDriverStatusRequest>(
      '/drivers/me/status',
      payload,
    )
  },

  sendLocation(payload: SendDriverLocationRequest) {
    return apiClient.post<SendDriverLocationResponse, SendDriverLocationRequest>(
      '/drivers/me/location',
      buildLocationPayload(payload),
    )
  },
}
