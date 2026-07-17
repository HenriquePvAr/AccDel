import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Order } from '@/types'

import type { OrderAction } from './order-actions'
import { OrderCard } from './OrderCard'

interface OrderGroupColumnProps {
  title: string
  subtitle: string
  orders: Order[]
  icon: LucideIcon
  tone: 'orange' | 'blue' | 'green'
  onOpen: (orderId: string) => void
  onAction: (orderId: string, action: OrderAction) => void
  canUpdate?: boolean
}

const toneClasses = {
  orange: {
    icon: 'bg-orange-500/12 text-orange-300 ring-orange-400/20',
    count: 'bg-orange-500/12 text-orange-200',
  },
  blue: {
    icon: 'bg-blue-500/12 text-blue-300 ring-blue-400/20',
    count: 'bg-blue-500/12 text-blue-200',
  },
  green: {
    icon: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/20',
    count: 'bg-emerald-500/12 text-emerald-200',
  },
}

export function OrderGroupColumn({
  title,
  subtitle,
  orders,
  icon: Icon,
  tone,
  onOpen,
  onAction,
  canUpdate = true,
}: OrderGroupColumnProps) {
  return (
    <section className="min-w-0 rounded-[22px] border border-white/10 bg-[#061525]/76 p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <header className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
            toneClasses[tone].icon,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-black tracking-tight text-white">{title}</h2>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black', toneClasses[tone].count)}>
              {orders.length}
            </span>
          </div>
          <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </header>

      <div className="space-y-2.5">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onOpen={onOpen}
            onAction={onAction}
            canUpdate={canUpdate}
          />
        ))}

        {!orders.length ? (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum pedido aqui agora.</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
