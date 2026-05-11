import { ChevronRight, LocateFixed, Route, TimerReset, Truck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Driver, DriverLocation } from '@/types'

import { DriverStatusPill } from './DriverStatusPill'
import {
  formatDistanceMeters,
  formatDriverLastUpdate,
  formatEtaMinutes,
  formatSpeedKmh,
  getPrimaryStop,
} from './driver-location-utils'

interface DriverListRowProps {
  driver: Driver
  location?: DriverLocation | null
  selected?: boolean
  onSelect?: (driverId: string) => void
  onOpenDispatchCenter?: (driverId: string) => void
}

export function DriverListRow({
  driver,
  location,
  selected = false,
  onSelect,
  onOpenDispatchCenter,
}: DriverListRowProps) {
  const primaryStop = getPrimaryStop(driver)
  const hasRoute = Boolean(primaryStop)
  const routeLabel = hasRoute
    ? `${primaryStop.orderNumber} · ${driver.queue.length} parada${driver.queue.length > 1 ? 's' : ''}`
    : 'Sem rota atribuida'

  const handleSelect = () => onSelect?.(driver.id)
  const handleOpenDispatch = () => onOpenDispatchCenter?.(driver.id)

  return (
    <div
      className={cn(
        'grid w-full gap-3 border-b border-white/6 px-4 py-3 text-left transition last:border-b-0 md:grid-cols-[minmax(220px,1.35fr)_120px_110px_minmax(220px,1.4fr)_84px_96px_150px] md:items-center',
        selected ? 'bg-primary/10 shadow-[inset_3px_0_0_#ea6d2c]' : 'hover:bg-white/[0.03]',
      )}
    >
      <button type="button" onClick={handleSelect} className="min-w-0 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-black text-white">
            {driver.name
              .split(' ')
              .slice(0, 2)
              .map((chunk) => chunk[0])
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{driver.name}</p>
            <p className="truncate text-xs text-slate-500">
              {driver.vehicle} · {driver.phone}
            </p>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 md:block">
        <DriverStatusPill driver={driver} compact />
      </div>

      <button
        type="button"
        onClick={handleSelect}
        className="flex items-center gap-1 text-left text-sm text-slate-300"
      >
        <Route className="h-3.5 w-3.5 text-slate-500" />
        <span>{formatSpeedKmh(location?.speedKmh)}</span>
      </button>

      <button type="button" onClick={handleSelect} className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold text-white">{routeLabel}</p>
        <p className="truncate text-xs text-slate-500">
          {primaryStop?.addressLabel ?? 'Sem destino ativo'}
        </p>
      </button>

      <button type="button" onClick={handleSelect} className="text-left text-sm font-semibold text-white">
        {formatEtaMinutes(primaryStop?.etaMinutes)}
      </button>

      <button type="button" onClick={handleSelect} className="text-left text-sm font-semibold text-slate-300">
        {formatDistanceMeters(primaryStop?.distanceMeters)}
      </button>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="hidden items-center gap-1.5 text-xs text-slate-500 xl:flex">
          <TimerReset className="h-3.5 w-3.5" />
          <span>{formatDriverLastUpdate(location)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl px-2.5"
            onClick={handleOpenDispatch}
          >
            <Truck className="h-3.5 w-3.5" />
            Despacho
          </Button>
          <button
            type="button"
            onClick={handleSelect}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300"
          >
            {selected ? (
              <LocateFixed className="h-4 w-4 text-primary" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
