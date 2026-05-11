import { CircleDot } from 'lucide-react'

import { formatDateFull } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

interface OrderTimelineProps {
  order: Order
  compact?: boolean
}

export function OrderTimeline({ order, compact = false }: OrderTimelineProps) {
  const entries = order.timeline ?? []

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1

        return (
          <div key={entry.id} className="relative flex gap-3">
            <div className="relative flex w-5 justify-center">
              <span
                className={cn(
                  'mt-1 flex h-4 w-4 items-center justify-center rounded-full border',
                  isLast
                    ? 'border-orange-300 bg-orange-500/25 text-orange-200'
                    : 'border-white/25 bg-[#071525] text-slate-400',
                )}
              >
                <CircleDot className="h-3 w-3" />
              </span>
              {!isLast ? <span className="absolute top-6 h-[calc(100%+0.25rem)] w-px bg-white/15" /> : null}
            </div>
            <div className="min-w-0 pb-3">
              <p className="font-bold text-slate-100">{entry.label}</p>
              <p className={cn('text-slate-400', compact ? 'text-xs' : 'text-sm')}>
                {entry.actor} · {formatDateFull(entry.at)}
              </p>
            </div>
          </div>
        )
      })}

      {!entries.length ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
          Nenhum evento registrado para este pedido.
        </p>
      ) : null}
    </div>
  )
}
