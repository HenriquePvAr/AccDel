import { Clock3, Pencil, UtensilsCrossed } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCompactCurrency, formatRelative } from '@/lib/format'
import type { Waiter } from '@/types'

function waiterStatusLabel(status: Waiter['status']) {
  if (status === 'serving') {
    return 'Atendendo'
  }

  if (status === 'paused') {
    return 'Pausado'
  }

  return 'Disponivel'
}

export function WaiterCard({
  waiter,
  onOpen,
  onEdit,
  onToggleActive,
  busy = false,
}: {
  waiter: Waiter
  onOpen: (waiterId: string) => void
  onEdit?: (waiterId: string) => void
  onToggleActive?: (waiter: Waiter) => void
  busy?: boolean
}) {
  return (
    <Card className="text-slate-100">
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold">{waiter.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{waiter.phone}</p>
          </div>
          <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
            {waiterStatusLabel(waiter.status)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <p className="text-muted-foreground">Pedidos</p>
            <p className="font-semibold">{waiter.totalOrders}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <p className="text-muted-foreground">Mesas</p>
            <p className="font-semibold">{waiter.tablesServed}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <p className="text-muted-foreground">Ticket medio</p>
            <p className="font-semibold">{formatCompactCurrency(waiter.averageTicket)}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <p className="text-muted-foreground">Vendas</p>
            <p className="font-semibold">{formatCompactCurrency(waiter.totalSales)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-4 w-4" />
            {waiter.lastActivityAt ? formatRelative(waiter.lastActivityAt) : 'Sem atividade'}
          </span>
          <span>{waiter.active ? 'Acesso ativo' : 'Acesso inativo'}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onOpen(waiter.id)}>
            Ver detalhes
          </Button>
          {onToggleActive ? (
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => onToggleActive(waiter)}
            >
              {waiter.active ? 'Desativar' : 'Ativar'}
            </Button>
          ) : null}
          {onEdit ? (
            <Button variant="outline" className="flex-1" onClick={() => onEdit(waiter.id)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
