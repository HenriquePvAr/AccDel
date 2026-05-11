import { useDroppable } from '@dnd-kit/core'

import { EmptyState } from '@/components/shared/EmptyState'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Inbox } from 'lucide-react'
import type { Order } from '@/types'

import { OrderCard } from './OrderCard'
import type { OrderAction } from './order-actions'

interface KanbanColumnProps {
  droppableId: string
  title: string
  description: string
  orders: Order[]
  onOpen: (orderId: string) => void
  onAction: (orderId: string, action: OrderAction) => void
  canUpdate?: boolean
}

export function KanbanColumn({
  droppableId,
  title,
  description,
  orders,
  onOpen,
  onAction,
  canUpdate = true,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${droppableId}`,
    data: { droppableId },
  })

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[600px] flex-col rounded-[26px] border p-4 backdrop-blur-xl transition ${
        isOver
          ? 'border-primary/45 bg-white/88 shadow-soft'
          : 'border-white/60 bg-white/60'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-sm font-semibold">
          {orders.length}
        </div>
      </div>
      <ScrollArea className="flex-1">
        {orders.length ? (
          <div className="space-y-4 pr-2">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onOpen={onOpen}
                onAction={onAction}
                canUpdate={canUpdate}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Coluna vazia"
            description="Nenhum pedido nesta etapa no momento."
          />
        )}
      </ScrollArea>
    </section>
  )
}
