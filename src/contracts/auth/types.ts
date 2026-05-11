import type { AuthenticatedAdminUser } from '@/types'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  data: {
    accessToken: string
    user: AuthenticatedAdminUser
  }
}

export interface MeResponse {
  data: AuthenticatedAdminUser
}
