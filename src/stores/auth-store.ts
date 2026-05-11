import { create } from 'zustand'

import type { AuthenticatedAdminUser } from '@/types'
import { authService } from '@/services/auth/auth-service'
import {
  clearApiAccessToken,
  getApiAccessToken,
  setApiAccessToken,
} from '@/services/http/api-client'

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

interface AuthSessionPayload {
  accessToken: string
  user: AuthenticatedAdminUser
}

interface AuthState {
  accessToken: string | null
  user: AuthenticatedAdminUser | null
  status: AuthStatus
  setSession: (session: AuthSessionPayload) => void
  setCurrentUser: (user: AuthenticatedAdminUser) => void
  clearSession: () => void
  bootstrapSession: () => Promise<void>
}

const storedAccessToken = getApiAccessToken()

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: storedAccessToken,
  user: null,
  status: storedAccessToken ? 'checking' : 'unauthenticated',

  setSession: ({ accessToken, user }) => {
    setApiAccessToken(accessToken)
    set({
      accessToken,
      user,
      status: 'authenticated',
    })
  },

  setCurrentUser: (user) => {
    set({
      user,
      status: 'authenticated',
    })
  },

  clearSession: () => {
    clearApiAccessToken()
    set({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    })
  },

  bootstrapSession: async () => {
    const token = getApiAccessToken()

    if (!token) {
      get().clearSession()
      return
    }

    set({
      accessToken: token,
      status: 'checking',
    })

    try {
      const response = await authService.me()
      get().setCurrentUser(response.data)
    } catch {
      get().clearSession()
    }
  },
}))
