import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'

import { ToastViewport } from '@/components/shared/ToastViewport'
import { queryClient, queryKeys } from '@/hooks/queries'
import { authUnauthorizedEvent } from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { useAuthStore } from '@/stores/auth-store'

function RealtimeBridge() {
  useEffect(() => {
    return mockRealtimeBus.subscribe((event) => {
      if (event.name.startsWith('order.')) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      }

      if (event.name.startsWith('catalog.')) {
        queryClient.invalidateQueries({ queryKey: ['catalog'] })
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      }

      if (event.name.startsWith('driver.')) {
        queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
        queryClient.invalidateQueries({ queryKey: queryKeys.drivers.locations })
      }

      if (event.name.startsWith('cash.')) {
        queryClient.invalidateQueries({ queryKey: queryKeys.cash.current })
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      }

      if (event.name.startsWith('dining.')) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dining.tables })
      }
    })
  }, [])

  return null
}

function AuthSessionBridge() {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  useEffect(() => {
    void bootstrapSession()
  }, [bootstrapSession])

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession()
      queryClient.clear()
    }

    window.addEventListener(authUnauthorizedEvent, handleUnauthorized)
    return () => window.removeEventListener(authUnauthorizedEvent, handleUnauthorized)
  }, [clearSession])

  return null
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionBridge />
      <RealtimeBridge />
      {children}
      <ToastViewport />
    </QueryClientProvider>
  )
}
