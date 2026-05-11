import { cn } from '@/lib/utils'
import type { OrderChannel, OrderStatus } from '@/types'
import { channelLabelMap } from '@/lib/domain'

import { orderStatusUi } from './order-ui'

interface OrderStatusBadgeProps {
  status?: OrderStatus
  channel?: OrderChannel
  className?: string
}

export function OrderStatusBadge({ status, channel, className }: OrderStatusBadgeProps) {
  if (channel) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-lg bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/15',
          className,
        )}
      >
        {channelLabelMap[channel]}
      </span>
    )
  }

  if (!status) {
    return null
  }

  const meta = orderStatusUi[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] ring-1',
        meta.badgeClass,
        className,
      )}
    >
      {meta.shortLabel}
    </span>
  )
}
