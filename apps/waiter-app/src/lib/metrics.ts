type MetricName =
  | 'login_success'
  | 'session_opened'
  | 'items_sent'
  | 'item_cancelled'
  | 'item_delivered'
  | 'close_requested'
  | 'session_transferred'
  | 'offline_blocked'

interface MetricEntry {
  name: MetricName
  at: string
  durationMs?: number
}

const buffer: MetricEntry[] = []

export function trackMetric(name: MetricName, durationMs?: number) {
  buffer.push({ name, at: new Date().toISOString(), durationMs })
  if (buffer.length > 100) buffer.shift()
  if (import.meta.env.DEV && import.meta.env.VITE_WAITER_DEBUG_METRICS === 'true') {
    console.info('[waiter-metric]', buffer.at(-1))
  }
}

export function readMetrics() {
  return buffer.slice()
}
