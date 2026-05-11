import {
  authUnauthorizedEvent,
  getApiAccessToken,
  shouldUseApi,
} from '@/services/http/api-client'

import type { AdminRealtimeEvent } from './events'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3333'

interface SubscribeToAdminRealtimeOptions {
  onEvent: (event: AdminRealtimeEvent) => void
  onConnectionChange?: (connected: boolean) => void
}

export function subscribeToAdminRealtime({
  onEvent,
  onConnectionChange,
}: SubscribeToAdminRealtimeOptions) {
  if (!shouldUseApi || typeof window === 'undefined') {
    return () => undefined
  }

  let disposed = false
  let reconnectTimer: number | null = null
  let controller: AbortController | null = null

  const scheduleReconnect = (delayMs: number) => {
    if (disposed) {
      return
    }

    reconnectTimer = window.setTimeout(() => {
      void connect()
    }, delayMs)
  }

  const dispatchUnauthorized = () => {
    window.dispatchEvent(new CustomEvent(authUnauthorizedEvent))
  }

  const processChunk = (chunk: string) => {
    const eventBlocks = chunk.split('\n\n').filter(Boolean)

    for (const block of eventBlocks) {
      const lines = block.split('\n')
      let eventName = ''
      let data = ''

      for (const rawLine of lines) {
        const line = rawLine.trim()

        if (!line || line.startsWith(':')) {
          continue
        }

        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        }

        if (line.startsWith('data:')) {
          data += line.slice(5).trim()
        }
      }

      if (!eventName || eventName === 'ping' || !data) {
        continue
      }

      try {
        const payload = JSON.parse(data) as AdminRealtimeEvent
        onEvent(payload)
      } catch {
        // Ignore malformed events to keep the stream alive.
      }
    }
  }

  const connect = async () => {
    if (disposed) {
      return
    }

    const token = getApiAccessToken()
    if (!token) {
      return
    }

    controller = new AbortController()

    try {
      const response = await fetch(`${apiBaseUrl}/drivers/stream/live`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          Cache: 'no-cache',
        },
        signal: controller.signal,
      })

      if (response.status === 401) {
        dispatchUnauthorized()
        return
      }

      if (!response.ok || !response.body) {
        throw new Error(`Falha ao abrir stream realtime (${response.status}).`)
      }

      onConnectionChange?.(true)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!disposed) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lastSeparator = buffer.lastIndexOf('\n\n')

        if (lastSeparator >= 0) {
          const complete = buffer.slice(0, lastSeparator)
          buffer = buffer.slice(lastSeparator + 2)
          processChunk(complete)
        }
      }
    } catch (error) {
      if (disposed || controller?.signal.aborted) {
        return
      }

      onConnectionChange?.(false)
      scheduleReconnect(2500)
      return
    }

    onConnectionChange?.(false)
    scheduleReconnect(1500)
  }

  void connect()

  return () => {
    disposed = true
    onConnectionChange?.(false)
    controller?.abort()
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
    }
  }
}
