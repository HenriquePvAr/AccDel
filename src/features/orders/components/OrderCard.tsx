import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Clock3,
  CreditCard,
  GripVertical,
  MapPin,
  Package,
  Route,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

import type { OrderAction } from './order-actions'
import { formatElapsedShort, getOrderItemCountLabel, getPrimaryOrderAction, orderStatusUi } from './order-ui'
import { OrderStatusBadge } from './OrderStatusBadge'

interface OrderCardProps {
  order: Order
  onOpen: (orderId: string) => void
  onAction: (orderId: string, action: OrderAction) => void
  canUpdate?: boolean
}

const primaryButtonClass = {
  orange: 'bg-orange-600 text-white hover:bg-orange-500',
  green: 'bg-emerald-600 text-white hover:bg-emerald-500',
  blue: 'bg-blue-600 text-white hover:bg-blue-500',
  neutral: 'border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]',
}

export function OrderCard({ order, onOpen, onAction, canUpdate = true }: OrderCardProps) {
  const statusMeta = orderStatusUi[order.status]
  const primaryAction = getPrimaryOrderAction(order)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: !canUpdate,
    data: {
      orderId: order.id,
      status: order.status,
      source: order.source,
    },
  })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  const handlePrimaryAction = () => {
    if (primaryAction.action && canUpdate) {
      onAction(order.id, primaryAction.action)
      return
    }

    onOpen(order.id)
  }

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative overflow-hidden rounded-[18px] border border-white/10 bg-[#07192b]/90 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:border-white/[0.18] hover:bg-[#092038]',
        'border-l-4',
        statusMeta.borderClass,
        isDragging && 'opacity-60',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_36%)]" />

      <div className="relative grid gap-2.5 p-3">
        <div className="min-w-0 space-y-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="hidden cursor-grab items-center rounded-full bg-white/[0.04] p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300 active:cursor-grabbing sm:inline-flex"
              onClick={(event) => event.stopPropagation()}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              onClick={() => onOpen(order.id)}
              className="shrink-0 font-mono text-base font-black tracking-tight text-white transition hover:text-orange-200"
            >
              {order.number}
            </button>
            <OrderStatusBadge status={order.status} className="shrink-0 px-2 py-0.5 text-[10px]" />
            {order.delayed ? (
              <span className="shrink-0 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.04em] text-red-300 ring-1 ring-red-400/20">
                Atrasado
              </span>
            ) : null}
            <span className="ml-auto shrink-0 font-mono text-base font-black text-white">
              {formatCurrency(order.total)}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="max-w-[220px] truncate font-bold text-slate-100 sm:max-w-[320px]">
              {order.customerName}
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <CreditCard className="h-3.5 w-3.5 text-slate-500" />
              {paymentLabelMap[order.paymentMethod]}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{channelLabelMap[order.source]}</span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Package className="h-3.5 w-3.5 text-slate-500" />
              {getOrderItemCountLabel(order)}
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Clock3 className="h-3.5 w-3.5 text-slate-500" />
              {formatElapsedShort(order.createdAt)}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-[52%]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{order.addressText ?? order.tableCode ?? 'Sem local informado'}</span>
            </span>
            <span className="hidden text-slate-600 sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5 text-slate-500" />
              Motoboy: <span className="font-semibold text-slate-300">{order.driver?.name ?? '---'}</span>
            </span>
            {order.estimatedDeliveryTimeMinutes || order.estimatedTotalTimeMinutes ? (
              <>
                <span className="text-slate-600">·</span>
                <span className="font-bold text-sky-300">
                  ETA {order.estimatedDeliveryTimeMinutes ?? order.estimatedTotalTimeMinutes} min
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpen(order.id)}
            className="h-8 rounded-lg border-white/10 bg-transparent px-3 text-xs font-black text-slate-100 hover:bg-white/[0.06]"
          >
            Detalhes
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            onClick={handlePrimaryAction}
            disabled={Boolean(primaryAction.action) && !canUpdate}
            className={cn(
              'h-8 rounded-lg px-3 text-xs font-black shadow-none',
              primaryButtonClass[primaryAction.tone],
            )}
          >
            {primaryAction.label}
          </Button>
        </div>
      </div>
    </motion.article>
  )
}
