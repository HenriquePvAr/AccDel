import { useEffect, useRef } from 'react'

import { getAccessToken, waiterStreamUrl } from './api'

export function useWaiterRealtime(onEvent: () => void, enabled = true) {
  const callback = useRef(onEvent)
  useEffect(() => {
    callback.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let retry = 1_000
    let controller: AbortController | null = null

    const connect = async () => {
      while (!cancelled) {
        const token = getAccessToken()
        if (!token || !navigator.onLine) {
          await delay(2_000)
          continue
        }
        controller = new AbortController()
        try {
          const response = await fetch(waiterStreamUrl(), {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
          if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`)
          retry = 1_000
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          while (!cancelled) {
            const chunk = await reader.read()
            if (chunk.done) break
            buffer += decoder.decode(chunk.value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''
            for (const event of events) {
              if (!event.includes('event: ping')) callback.current()
            }
          }
        } catch {
          if (cancelled) return
          await delay(retry)
          retry = Math.min(retry * 2, 15_000)
        }
      }
    }

    void connect()
    return () => {
      cancelled = true
      controller?.abort()
    }
  }, [enabled])
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
