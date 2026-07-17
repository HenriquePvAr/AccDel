export type OperationalView = 'preparation' | 'dispatch'

export type OperationalStatus =
  | 'in_analysis'
  | 'in_preparation'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'

export type OrderTimingState = 'normal' | 'warning' | 'late' | 'closed' | 'unknown'

export interface OrderTiming {
  label: string
  state: OrderTimingState
  minutes: number | null
}

const statusesByView: Record<OperationalView, readonly OperationalStatus[]> = {
  preparation: ['in_analysis', 'in_preparation', 'ready'],
  dispatch: ['ready', 'out_for_delivery', 'completed'],
}

export function getOperationalStatuses(view: OperationalView) {
  return statusesByView[view]
}

export function isStatusInOperationalView(status: string, view: OperationalView) {
  return statusesByView[view].includes(status as OperationalStatus)
}

export function getOrderTiming(
  order: { status: string; dueAt?: string | null },
  now = Date.now(),
): OrderTiming {
  if (order.status === 'completed' || order.status === 'cancelled') {
    return { label: 'Encerrado', state: 'closed', minutes: null }
  }

  if (!order.dueAt) {
    return { label: 'Sem previsao', state: 'unknown', minutes: null }
  }

  const dueAt = new Date(order.dueAt).getTime()

  if (!Number.isFinite(dueAt)) {
    return { label: 'Sem previsao', state: 'unknown', minutes: null }
  }

  const deltaMinutes = Math.ceil((dueAt - now) / 60_000)

  if (deltaMinutes <= 0) {
    const minutesLate = Math.max(1, Math.ceil((now - dueAt) / 60_000))
    return {
      label: `${minutesLate} min atrasado${minutesLate === 1 ? '' : 's'}`,
      state: 'late',
      minutes: minutesLate,
    }
  }

  return {
    label: `${deltaMinutes} min restante${deltaMinutes === 1 ? '' : 's'}`,
    state: deltaMinutes <= 10 ? 'warning' : 'normal',
    minutes: deltaMinutes,
  }
}

export function isOrderLate(order: { status: string; dueAt?: string | null }, now = Date.now()) {
  return getOrderTiming(order, now).state === 'late'
}

export function getVisibleOperationalItems<T>(items: readonly T[], expanded: boolean, limit = 6) {
  return expanded ? items : items.slice(0, limit)
}
