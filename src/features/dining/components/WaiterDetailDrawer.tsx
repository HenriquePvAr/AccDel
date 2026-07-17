import { Receipt, UtensilsCrossed } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCompactCurrency, formatDateTime, formatRelative } from '@/lib/format'
import type { Waiter } from '@/types'

export function WaiterDetailDrawer({
  waiter,
  open,
  onOpenChange,
}: {
  waiter: Waiter | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!waiter) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{waiter.name}</SheetTitle>
          <SheetDescription>
            {waiter.phone}
            {waiter.lastActivityAt ? ` · atividade ${formatRelative(waiter.lastActivityAt)}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin">
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm">
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Pedidos lancados</p>
                <p className="font-semibold">{waiter.totalOrders}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Mesas atendidas</p>
                <p className="font-semibold">{waiter.tablesServed}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Cancelamentos</p>
                <p className="font-semibold">{waiter.cancellations}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <p className="text-muted-foreground">Ticket medio</p>
                <p className="font-semibold">{formatCompactCurrency(waiter.averageTicket)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Venda acumulada</h4>
              </div>
              <div className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm ring-1 ring-white/10">
                <p className="text-muted-foreground">Total no periodo</p>
                <p className="mt-1 text-lg font-semibold">{formatCompactCurrency(waiter.totalSales)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Histórico</h4>
              </div>
              {waiter.history.length ? (
                waiter.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-3 text-sm ring-1 ring-white/10"
                  >
                    <div>
                      <p className="font-medium">{entry.label}</p>
                      <p className="text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <div className="font-semibold">
                      {typeof entry.value === 'number' ? formatCompactCurrency(entry.value) : '-'}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
