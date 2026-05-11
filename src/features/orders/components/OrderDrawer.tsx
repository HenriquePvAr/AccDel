import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Timeline } from '@/components/shared/Timeline'
import { Card, CardContent } from '@/components/ui/card'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency, formatDateFull } from '@/lib/format'
import type { Order } from '@/types'

import { type OrderAction, getOrderActionOptions } from './order-actions'

interface OrderDrawerProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (orderId: string, action: OrderAction) => void
  canUpdate?: boolean
}

export function OrderDrawer({
  order,
  open,
  onOpenChange,
  onAction,
  canUpdate = true,
}: OrderDrawerProps) {
  if (!order) {
    return null
  }

  const actions = getOrderActionOptions(order)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <StatusBadge channel={order.source} />
          </div>
          <SheetTitle className="mt-2">{order.number} · {order.customerName}</SheetTitle>
          <SheetDescription>
            {order.addressText ?? order.tableCode ?? 'Retirada no balcão'} · criado em{' '}
            {formatDateFull(order.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Status atual</p>
                  <p className="font-semibold">
                    <StatusBadge status={order.status} />
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Canal</p>
                  <p className="font-semibold">{channelLabelMap[order.source]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagamento</p>
                  <p className="font-semibold">{paymentLabelMap[order.paymentMethod]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-semibold">{order.customerPhone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-mono text-base font-semibold">{formatCurrency(order.total)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estimativa prevista</p>
                  <p className="font-semibold">
                    {order.estimatedTotalTimeMinutes
                      ? `${order.estimatedTotalTimeMinutes} min`
                      : 'Nao configurada'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entrega prevista</p>
                  <p className="font-semibold">{formatDateFull(order.dueAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Motoboy atribuido</p>
                  <p className="font-semibold">
                    {order.driver ? `${order.driver.name} · ${order.driver.phone}` : 'Nao atribuido'}
                  </p>
                </div>
              </div>
              {order.source === 'delivery' && order.status === 'ready' && !order.driver ? (
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3 text-sm text-foreground">
                  Pedido pronto para despacho. Selecione um motoboy para mover para Em rota.
                </div>
              ) : null}
              {order.notes ? (
                <div className="rounded-2xl bg-secondary/60 p-3 text-sm text-secondary-foreground">
                  {order.notes}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h4 className="font-semibold">Itens</h4>
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10">
                  <div>
                    <p className="font-medium">
                      {item.quantity}x {item.name}
                    </p>
                    {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
                  </div>
                  <span className="font-mono text-sm">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h4 className="font-semibold">Linha do tempo</h4>
              <Timeline items={order.timeline} />
            </CardContent>
          </Card>
        </div>

        {canUpdate && actions.length ? (
          <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4">
            {actions.map((action) => (
              <Button
                key={action.key}
                variant={action.key === 'cancel' ? 'ghost' : 'default'}
                onClick={() => onAction(order.id, action.key)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
