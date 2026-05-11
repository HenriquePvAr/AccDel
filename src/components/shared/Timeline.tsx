import { CircleDot } from 'lucide-react'

import type { TimelineEntry } from '@/types'
import { formatDateTime } from '@/lib/format'

interface TimelineProps {
  items: TimelineEntry[]
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div className="pt-0.5 text-primary">
            <CircleDot className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {item.actor} · {formatDateTime(item.at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
