import { Bike, Clock3, Pencil, Route } from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCompactCurrency, formatRelative } from '@/lib/format'
import type { Driver, DriverLocation } from '@/types'

interface DriverCardProps {
  driver: Driver
  location?: DriverLocation
  selected: boolean
  onSelect: (driverId: string) => void
  onEdit?: (driverId: string) => void
}

export function DriverCard({ driver, location, selected, onSelect, onEdit }: DriverCardProps) {
  return (
    <Card
      className={
        selected
          ? 'border-primary/60 text-slate-100 shadow-[0_22px_42px_rgba(198,93,46,0.18)]'
          : 'text-slate-100'
      }
    >
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-primary" />
              <h3 className="text-base font-black tracking-tight">{driver.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {driver.vehicle} - {driver.phone}
            </p>
          </div>
          <StatusBadge status={driver.availability} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetricTile
            label="Velocidade"
            value={location ? `${Math.round(location.speedKmh)} km/h` : 'Sem sinal'}
          />
          <MetricTile
            label="Concluidas"
            value={`${driver.completedOrders ?? driver.totalDeliveries ?? 0}`}
          />
          <MetricTile label="Em andamento" value={`${driver.queue.length}`} />
          <MetricTile
            label="Valor atendido"
            value={formatCompactCurrency(driver.totalAssignedRevenue ?? 0)}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-2 flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Fila atual
            </p>
          </div>
          {driver.queue.length ? (
            driver.queue.map((stop) => (
              <div key={stop.orderId} className="flex items-center justify-between gap-3 py-1">
                <span className="font-semibold text-slate-100">{stop.orderNumber}</span>
                <span className="truncate text-muted-foreground">{stop.addressLabel}</span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Sem pedidos atribuidos.</p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-4 w-4" />
            {driver.lastActivityAt ? formatRelative(driver.lastActivityAt) : 'Sem atividade'}
          </span>
          <span>{driver.active === false ? 'Acesso inativo' : 'Acesso ativo'}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onSelect(driver.id)}>
            {selected ? 'Detalhes em foco' : 'Ver detalhes'}
          </Button>
          {onEdit ? (
            <Button variant="outline" className="flex-1" onClick={() => onEdit(driver.id)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono text-base font-black text-slate-100">{value}</p>
    </div>
  )
}
