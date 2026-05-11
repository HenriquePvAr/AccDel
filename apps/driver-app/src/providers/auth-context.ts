import { createContext } from 'react'

import type { DriverSessionUser } from '../types/api'

export type DriverAuthStatus = 'booting' | 'authenticated' | 'unauthenticated'

export interface DriverAuthContextValue {
  status: DriverAuthStatus
  user: DriverSessionUser | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const DriverAuthContext = createContext<DriverAuthContextValue | null>(null)
