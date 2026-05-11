import type { LoginResponse, MeResponse } from '../types/api'
import { apiClient } from './client'

export const authApi = {
  login(email: string, password: string) {
    return apiClient.post<LoginResponse, { email: string; password: string }>(
      '/auth/login',
      { email, password },
      { skipAuth: true },
    )
  },

  me() {
    return apiClient.get<MeResponse>('/auth/me')
  },
}
