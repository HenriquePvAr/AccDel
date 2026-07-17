import { Users } from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { DiningTable, TableSession } from '@/types'

interface TableCardProps {
  table: DiningTable
  session?: TableSession
  onOpen: (tableId: string) => void
}

export function TableCard({ table, session, onOpen }: TableCardProps) {
  return (
    <button onClick={() => onOpen(table.id)} className="text-left">
      <Card className="h-full min-h-[196px] rounded-[24px] p-4 text-slate-100 transition hover:-translate-y-0.5 hover:border-primary/35">
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Mesa
              </p>
              <h3 className="mt-2 text-3xl font-bold">{table.code}</h3>
            </div>
            <StatusBadge status={table.status} />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>
                  {table.guests ?? 0}/{table.capacity} lugares
                </span>
              </div>
              {table.waiterName ? <span>{table.waiterName}</span> : null}
            </div>

            {session ? (
              <div className="space-y-2 rounded-2xl bg-white/[0.04] px-3 py-3 ring-1 ring-white/10">
                <div>
                  <p className="font-medium">Consumo atual</p>
                  <p className="text-muted-foreground">{session.items.length} itens lancados</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {session.waiterName ?? 'Sem garcom'}
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(session.total)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.04] px-3 py-2 text-muted-foreground ring-1 ring-white/10">
                Mesa pronta
              </div>
            )}
          </div>
        </div>
      </Card>
    </button>
  )
}
