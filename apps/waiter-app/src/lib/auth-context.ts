import { createContext, useContext } from 'react'

import type { SessionUser } from '@/types'

export interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  login(email: string, password: string): Promise<void>
  logout(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.')
  return value
}
