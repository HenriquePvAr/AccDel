import { useEffect, useMemo, useState, type ReactNode } from 'react'

import type { SessionUser } from '@/types'
import { apiRequest, getAccessToken, setAccessToken } from './api'
import { AuthContext, type AuthContextValue } from './auth-context'
import { clearUserDrafts } from './drafts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(Boolean(getAccessToken()))

  useEffect(() => {
    const invalidate = () => {
      setAccessToken(null)
      setUser(null)
      setLoading(false)
    }
    window.addEventListener('cain-waiter:unauthorized', invalidate)
    return () => window.removeEventListener('cain-waiter:unauthorized', invalidate)
  }, [])

  useEffect(() => {
    if (!getAccessToken()) return
    void apiRequest<{ data: SessionUser }>('/auth/me')
      .then(({ data }) => {
        if (!['waiter', 'manager'].includes(data.role)) throw new Error('Papel sem acesso ao PWA.')
        setUser(data)
      })
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const response = await apiRequest<{ data: { accessToken: string; user: SessionUser } }>(
          '/auth/login',
          {
            method: 'POST',
            public: true,
            body: JSON.stringify({ email, password }),
          },
        )
        if (!['waiter', 'manager'].includes(response.data.user.role)) {
          throw new Error('Este usuário não tem acesso ao aplicativo de garçom.')
        }
        setAccessToken(response.data.accessToken)
        setUser(response.data.user)
      },
      logout() {
        if (user) clearUserDrafts(user.store.id, user.id)
        setAccessToken(null)
        setUser(null)
        window.dispatchEvent(new Event('cain-waiter:logout'))
      },
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
