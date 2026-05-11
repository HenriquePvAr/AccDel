import { Bike, Clock3, Route } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCompactCurrency, formatRelative } from '@/lib/format'
import type { Driver, Order } from '@/types'

interface DispatchOrderDialogProps {
  open: boolean
  order: Order | null
  drivers: Driver[]
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (driverId: string) => void
}

export function DispatchOrderDialog({
  open,
  order,
  drivers,
  busy = false,
  onOpenChange,
  onConfirm,
}: DispatchOrderDialogProps) {
  const eligibleDrivers = drivers.filter(
    (driver) => (driver.active ?? true) && driver.availability !== 'paused',
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Despachar pedido</DialogTitle>
          <DialogDescription>
            {order
              ? `${order.number} pronto para rota. Escolha um motoboy ativo para assumir o despacho.`
              : 'Selecione um motoboy para enviar o pedido para rota.'}
          </DialogDescription>
        </DialogHeader>

        {eligibleDrivers.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {eligibleDrivers.map((driver) => (
              <button
                key={driver.id}
                type="button"
                disabled={busy}
                onClick={() => onConfirm(driver.id)}
                className="rounded-[24px] border border-border/70 bg-white p-4 text-left transition hover:-translate-y-px hover:border-primary/45 hover:bg-secondary/25 disabled:cursor-wait disabled:opacity-70"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bike className="h-4 w-4 text-primary" />
                      <h3 className="text-base font-semibold">{driver.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {driver.phone} · {driver.vehicle}
                    </p>
                  </div>
                  <StatusBadge status={driver.availability} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/[0.04] px-3 py-3 ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Entregas
                    </p>
                    <p className="mt-1 font-semibold">
                      {driver.completedOrders ?? driver.totalDeliveries ?? 0} concluidas
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] px-3 py-3 ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Ticket
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatCompactCurrency(driver.totalAssignedRevenue ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" />
                    {driver.averageDeliveryMinutes} min medio
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Route className="h-4 w-4" />
                    {driver.queue.length} pedidos em rota
                  </span>
                  {driver.lastActivityAt ? (
                    <span>Ativo {formatRelative(driver.lastActivityAt)}</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bike className="h-5 w-5" />}
            title="Nenhum motoboy disponivel"
            description="Ative um motoboy ou tire alguem do estado pausado antes de despachar."
          />
        )}

        <div className="flex justify-end border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
