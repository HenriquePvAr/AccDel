import { Bike, Clock3, Receipt, Route } from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCompactCurrency, formatDateTime, formatRelative } from '@/lib/format'
import type { Driver } from '@/types'

interface DriverDetailDrawerProps {
  driver: Driver | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DriverDetailDrawer({
  driver,
  open,
  onOpenChange,
}: DriverDetailDrawerProps) {
  if (!driver) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <StatusBadge status={driver.availability} />
          </div>
          <SheetTitle className="mt-2">{driver.name}</SheetTitle>
          <SheetDescription>
            {driver.vehicle} · {driver.phone}
            {driver.lastActivityAt ? ` · atividade ${formatRelative(driver.lastActivityAt)}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin">
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm">
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Entregas concluidas</p>
                <p className="font-semibold">{driver.completedOrders ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Canceladas</p>
                <p className="font-semibold">{driver.cancelledOrders ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Tempo medio</p>
                <p className="font-semibold">{driver.averageDeliveryMinutes} min</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Valor atendido</p>
                <p className="font-semibold">
                  {formatCompactCurrency(driver.totalAssignedRevenue ?? 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Pedidos em andamento</h4>
              </div>
              {driver.queue.length ? (
                driver.queue.map((stop) => (
                  <div
                    key={stop.orderId}
                    className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-3 text-sm ring-1 ring-white/10"
                  >
                    <div>
                      <p className="font-medium">{stop.orderNumber}</p>
                      <p className="text-muted-foreground">{stop.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{stop.etaMinutes} min</p>
                      <p className="text-xs text-muted-foreground">{stop.addressLabel}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem entregas em rota.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Historico recente</h4>
              </div>
              {driver.history?.length ? (
                driver.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-3 text-sm ring-1 ring-white/10"
                  >
                    <div>
                      <p className="font-medium">{entry.orderNumber}</p>
                      <p className="text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={entry.status} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem historico operacional ainda.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Ultima atividade</h4>
              </div>
              <div className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm ring-1 ring-white/10">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {driver.lastActivityAt
                      ? formatDateTime(driver.lastActivityAt)
                      : 'Sem atividade registrada'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
