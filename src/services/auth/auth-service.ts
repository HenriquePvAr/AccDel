import type { LoginRequest, LoginResponse, MeResponse } from '@/contracts/auth'
import { apiClient, clearApiAccessToken, setApiAccessToken } from '@/services/http/api-client'

export const authService = {
  async login(payload: LoginRequest) {
    const response = await apiClient.post<LoginResponse, LoginRequest>('/auth/login', payload, {
      skipAuth: true,
    })
    setApiAccessToken(response.data.accessToken)
    return response
  },

  me() {
    return apiClient.get<MeResponse>('/auth/me')
  },

  logout() {
    clearApiAccessToken()
  },
}
