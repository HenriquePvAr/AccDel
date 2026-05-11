import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { authApi } from '../api/auth'
import { setApiAccessToken } from '../api/client'
import type { DriverSessionUser } from '../types/api'
import {
  DriverAuthContext,
  type DriverAuthContextValue,
} from './auth-context'

const sessionStorageKey = 'cain-driver.session'

export function DriverAuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<'booting' | 'authenticated' | 'unauthenticated'>(
    'booting',
  )
  const [user, setUser] = useState<DriverSessionUser | null>(null)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)

  const persistSession = useCallback(
    async (nextToken: string, nextUser: DriverSessionUser) => {
      setApiAccessToken(nextToken)
      setAccessTokenState(nextToken)
      setUser(nextUser)
      setStatus('authenticated')
      await AsyncStorage.setItem(
        sessionStorageKey,
        JSON.stringify({
          accessToken: nextToken,
          user: nextUser,
        }),
      )
    },
    [],
  )

  const clearSession = useCallback(async () => {
    setApiAccessToken(null)
    setAccessTokenState(null)
    setUser(null)
    setStatus('unauthenticated')
    await AsyncStorage.removeItem(sessionStorageKey)
  }, [])

  const restoreSession = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(sessionStorageKey)
      if (!raw) {
        setStatus('unauthenticated')
        return
      }

      const stored = JSON.parse(raw) as {
        accessToken: string
        user: DriverSessionUser
      }

      setApiAccessToken(stored.accessToken)
      setAccessTokenState(stored.accessToken)

      const me = await authApi.me()
      if (me.data.role !== 'driver') {
        await clearSession()
        return
      }

      await persistSession(stored.accessToken, me.data)
    } catch {
      await clearSession()
    }
  }, [clearSession, persistSession])

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      void restoreSession()
    }, 0)

    return () => {
      clearTimeout(bootstrapTimer)
    }
  }, [restoreSession])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password)

      if (response.data.user.role !== 'driver') {
        throw new Error('Esta conta nao pertence a um motoboy.')
      }

      await persistSession(response.data.accessToken, response.data.user)
    },
    [persistSession],
  )

  const logout = useCallback(async () => {
    await clearSession()
  }, [clearSession])

  const value = useMemo<DriverAuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      login,
      logout,
    }),
    [accessToken, login, logout, status, user],
  )

  return (
    <DriverAuthContext.Provider value={value}>
      {children}
    </DriverAuthContext.Provider>
  )
}
