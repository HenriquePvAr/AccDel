import { cn } from '@/lib/utils'
import type { Driver } from '@/types'

import { getDriverFilterBucket, getDriverStatusLabel } from './driver-location-utils'

interface DriverStatusPillProps {
  driver: Driver
  compact?: boolean
}

const toneMap = {
  delivering:
    'border-sky-400/24 bg-sky-400/12 text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
  available:
    'border-emerald-400/24 bg-emerald-400/12 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
  paused:
    'border-amber-400/24 bg-amber-400/12 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
  offline:
    'border-slate-500/24 bg-slate-500/12 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
}

export function DriverStatusPill({ driver, compact = false }: DriverStatusPillProps) {
  const bucket = getDriverFilterBucket(driver)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-[-0.01em]',
        compact && 'px-2 py-0.5 text-[11px]',
        toneMap[bucket],
      )}
    >
      {getDriverStatusLabel(driver)}
    </span>
  )
}
