import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'

import { ToastViewport } from '@/components/shared/ToastViewport'
import { queryClient, queryKeys } from '@/hooks/queries'
import { authUnauthorizedEvent, shouldUseApi } from '@/services/http/api-client'
import { subscribeToAdminRealtime } from '@/services/realtime/admin-realtime-stream'
import type { AdminRealtimeEvent } from '@/services/realtime/events'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { useAuthStore } from '@/stores/auth-store'

function invalidateRealtimeEvent(event: AdminRealtimeEvent) {
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
}

function RealtimeBridge() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    if (!shouldUseApi) {
      return mockRealtimeBus.subscribe(invalidateRealtimeEvent)
    }

    if (!accessToken || status !== 'authenticated') {
      return
    }

    return subscribeToAdminRealtime({
      onEvent: invalidateRealtimeEvent,
    })
  }, [accessToken, status])

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
