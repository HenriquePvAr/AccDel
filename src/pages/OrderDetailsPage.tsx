import {
  ArrowLeft,
  Bike,
  ChefHat,
  Clock3,
  CreditCard,
  Map,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Printer,
  ReceiptText,
  Send,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DispatchOrderDialog } from '@/features/orders/components/DispatchOrderDialog'
import { OrderActionBar } from '@/features/orders/components/OrderActionBar'
import type { OrderAction } from '@/features/orders/components/order-actions'
import { getOrderActionOptions } from '@/features/orders/components/order-actions'
import { getOrderItemCountLabel, orderStatusUi, formatElapsedShort } from '@/features/orders/components/order-ui'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { OrderTimeline } from '@/features/orders/components/OrderTimeline'
import { useDriversQuery, useOrderByIdQuery, useUpdateOrderStatusMutation } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency, formatDateFull } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

function DetailCard({
  title,
  icon,
  className,
  children,
}: {
  title: string
  icon: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-[24px] border border-white/10 bg-[#071a2d]/88 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300 ring-1 ring-white/10">
          {icon}
        </span>
        <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function getNextOperationalAction(order: Order): OrderAction | null {
  const action = getOrderActionOptions(order).find((option) => option.key !== 'cancel')
  return action?.key ?? null
}

function getPrimaryLabel(action: OrderAction | null) {
  if (action === 'dispatch') {
    return 'Despachar pedido'
  }

  if (action === 'complete') {
    return 'Finalizar pedido'
  }

  return 'Avancar status'
}

export function OrderDetailsPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const canUpdateOrders = useCan('orders:update')
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const orderQuery = useOrderByIdQuery(orderId ?? null)
  const driversQuery = useDriversQuery()
  const updateOrderStatus = useUpdateOrderStatusMutation()
  const order = orderQuery.data?.data ?? null

  usePageTitle(order ? `${order.number} · Pedido` : 'Detalhe do pedido')

  const drivers = useMemo(() => driversQuery.data?.data ?? [], [driversQuery.data?.data])
  const dispatchableDrivers = useMemo(
    () => drivers.filter((driver) => (driver.active ?? true) && driver.availability !== 'paused'),
    [drivers],
  )
  const nextAction = order ? getNextOperationalAction(order) : null
  const completeDisabled = !order || order.status === 'completed' || order.status === 'cancelled'

  const runAction = (action: OrderAction | null) => {
    if (!order || !action || !canUpdateOrders) {
      return
    }

    if (action === 'dispatch') {
      setDispatchOpen(true)
      return
    }

    updateOrderStatus.mutate({
      orderId: order.id,
      action,
      actor: action === 'ready' ? 'Cozinha' : 'Operacao',
    })
  }

  const handleDispatch = (driverId: string) => {
    if (!order || !canUpdateOrders) {
      return
    }

    updateOrderStatus.mutate(
      {
        orderId: order.id,
        action: 'dispatch',
        driverId,
      },
      {
        onSuccess: () => setDispatchOpen(false),
      },
    )
  }

  if (orderQuery.isLoading) {
    return (
      <PageShell className="text-slate-100">
        <Skeleton className="mb-6 h-12 w-80 bg-white/10" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-[24px] bg-white/10" />
          ))}
        </div>
      </PageShell>
    )
  }

  if (!order) {
    return (
      <PageShell className="flex min-h-[calc(100vh-72px)] items-center justify-center text-slate-100">
        <div className="rounded-[28px] border border-white/10 bg-[#071a2d]/80 p-8">
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="Pedido nao encontrado"
            description="O pedido pode ter sido removido ou voce nao tem permissao para acessa-lo."
          />
          <Button className="mt-5 w-full bg-orange-600 text-white hover:bg-orange-500" onClick={() => navigate('/orders')}>
            Voltar para pedidos
          </Button>
        </div>
      </PageShell>
    )
  }

  const statusMeta = orderStatusUi[order.status]
  const StatusIcon = statusMeta.icon

  return (
    <PageShell className="pb-28 text-slate-100">
          <header className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigate('/orders')}
                  className="rounded-2xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <p className="hidden text-sm font-semibold text-slate-400 sm:block">
                  Pedidos / Delivery / {order.number}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  {order.number} · {order.customerName}
                </h1>
                <OrderStatusBadge status={order.status} />
                <OrderStatusBadge channel={order.source} />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <Clock3 className="h-4 w-4" />
                Pedido criado em {formatDateFull(order.createdAt)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Falar com cliente</span>
              </Button>
              <Button
                type="button"
                disabled={!canUpdateOrders || !nextAction || updateOrderStatus.isPending}
                onClick={() => runAction(nextAction)}
                className="h-11 rounded-xl bg-orange-600 px-5 font-bold text-white hover:bg-orange-500"
              >
                {getPrimaryLabel(nextAction)}
              </Button>
            </div>
          </header>

          <div className="mb-4 grid gap-3 rounded-[22px] border border-white/10 bg-[#071a2d]/88 p-4 sm:grid-cols-2 lg:hidden">
            <div className="flex items-center gap-3">
              <StatusIcon className={cn('h-7 w-7', statusMeta.textClass)} />
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Preparo</p>
                <p className="text-xl font-black text-white">
                  {order.estimatedPrepTimeMinutes ?? '--'} min
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Entrega estimada</p>
              <p className="text-xl font-black text-white">
                {order.estimatedDeliveryTimeMinutes ?? order.estimatedTotalTimeMinutes ?? '--'} min
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr_0.78fr]">
            <div className="space-y-4">
              <DetailCard title="Cliente" icon={<UserRound className="h-5 w-5" />}>
                <div className="grid gap-5 sm:grid-cols-[1fr_0.85fr]">
                  <div>
                    <p className="text-lg font-black text-white">{order.customerName}</p>
                    <p className="mt-1 text-sky-300">{order.customerPhone}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {order.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-slate-300 ring-1 ring-white/10"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-4 text-sm text-slate-300 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Observacoes</p>
                    <p className="mt-2">{order.notes || 'Sem observacoes do cliente.'}</p>
                  </div>
                </div>
              </DetailCard>

              <DetailCard title="Endereco de entrega" icon={<MapPin className="h-5 w-5" />}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">
                      {order.addressText ?? order.tableCode ?? 'Endereco nao informado'}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Referencia: {order.addressLabel ?? 'Nao informada'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/10 bg-white/[0.04] text-sky-300 hover:bg-white/[0.08]"
                  >
                    <Map className="h-4 w-4" />
                    Ver no mapa
                  </Button>
                </div>
              </DetailCard>

              <DetailCard title="Itens do pedido" icon={<ReceiptText className="h-5 w-5 text-orange-300" />}>
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-white">
                            {item.quantity}x {item.name}
                          </p>
                          {item.options.length ? (
                            <ul className="mt-2 space-y-1 text-sm text-slate-400">
                              {item.options.map((option) => (
                                <li key={option.id}>
                                  {option.quantity}x {option.name}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {item.notes ? <p className="mt-2 text-sm text-orange-200">{item.notes}</p> : null}
                        </div>
                        <p className="font-mono font-black text-white">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal dos itens</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Taxa de entrega</span>
                    <span>{formatCurrency(order.deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-300">
                    <span>Desconto</span>
                    <span>- {formatCurrency(order.discount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4 text-xl font-black text-white">
                    <span>Total do pedido</span>
                    <span className="text-orange-300">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </DetailCard>
            </div>

            <div className="space-y-4">
              <DetailCard title="Pagamento e origem" icon={<CreditCard className="h-5 w-5" />}>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pagamento</p>
                      <p className="mt-2 text-lg font-bold text-white">{paymentLabelMap[order.paymentMethod]}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Valor pago</p>
                      <p className="mt-2 text-lg font-bold text-white">{formatCurrency(order.total)}</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Origem</p>
                    <p className="mt-2 text-lg font-bold text-white">{channelLabelMap[order.source]}</p>
                  </div>
                  <div className="border-t border-white/10 pt-4 text-sm text-slate-400">
                    Criado em {formatDateFull(order.createdAt)}
                  </div>
                </div>
              </DetailCard>

              <DetailCard title="Entrega / Despacho" icon={<Bike className="h-5 w-5" />}>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Motoboy atribuido</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{order.driver?.name ?? 'Nao atribuido'}</p>
                        <p className="text-sm text-slate-400">{order.driver?.phone ?? 'Aguardando despacho'}</p>
                      </div>
                      {order.status === 'ready' ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!canUpdateOrders}
                          onClick={() => setDispatchOpen(true)}
                          className="rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                        >
                          Alterar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Previsao</p>
                      <p className="mt-2 text-lg font-black text-white">
                        {order.estimatedDeliveryTimeMinutes ?? order.estimatedTotalTimeMinutes ?? '--'} min
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Criado ha</p>
                      <p className={cn('mt-2 text-lg font-black', statusMeta.textClass)}>
                        {formatElapsedShort(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  {order.source === 'delivery' && order.status === 'ready' ? (
                    <Button
                      type="button"
                      disabled={!canUpdateOrders}
                      onClick={() => setDispatchOpen(true)}
                      className="h-12 w-full rounded-xl border border-orange-400/35 bg-transparent font-bold text-orange-200 hover:bg-orange-500/10"
                    >
                      <Send className="h-4 w-4" />
                      Despachar pedido
                    </Button>
                  ) : null}
                </div>
              </DetailCard>
            </div>

            <div className="space-y-4">
              <DetailCard title="Timeline do pedido" icon={<Clock3 className="h-5 w-5" />}>
                <OrderTimeline order={order} compact />
              </DetailCard>

              <DetailCard title="Informacoes da cozinha" icon={<ChefHat className="h-5 w-5" />}>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-orange-400/80 bg-orange-500/10">
                    <span className="text-2xl font-black text-white">
                      {order.estimatedPrepTimeMinutes ?? '--'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Prazo de preparo</p>
                    <p className="mt-1 font-bold text-white">
                      Meta: {order.estimatedPrepTimeMinutes ?? '--'} min
                    </p>
                    <p className="mt-1 text-sm text-emerald-300">
                      {order.delayed ? 'Fora do prazo' : 'Dentro do prazo'}
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  {order.notes || `${getOrderItemCountLabel(order)} para producao.`}
                </div>
              </DetailCard>
            </div>
          </div>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-2 border-t border-white/10 bg-[#06111f]/95 p-3 backdrop-blur-xl lg:hidden">
        <Button variant="outline" className="h-12 rounded-xl border-white/10 bg-transparent text-slate-100 hover:bg-white/[0.06]">
          <Phone className="h-4 w-4" />
          Ligar
        </Button>
        <Button variant="outline" className="h-12 rounded-xl border-white/10 bg-transparent text-slate-100 hover:bg-white/[0.06]">
          <MoreHorizontal className="h-4 w-4" />
          Mais
        </Button>
        <Button
          disabled={!canUpdateOrders || !nextAction || updateOrderStatus.isPending}
          onClick={() => runAction(nextAction)}
          className="h-12 rounded-xl bg-orange-600 font-bold text-white hover:bg-orange-500"
        >
          Avancar
        </Button>
      </div>

      <div className="hidden px-8 lg:block">
        <OrderActionBar
          primaryLabel={getPrimaryLabel(nextAction)}
          canUpdate={canUpdateOrders}
          busy={updateOrderStatus.isPending}
          onPrimary={() => runAction(nextAction)}
          onComplete={() => runAction('complete')}
          completeDisabled={completeDisabled}
        />
      </div>

      <DispatchOrderDialog
        open={dispatchOpen}
        order={order}
        drivers={dispatchableDrivers}
        busy={updateOrderStatus.isPending}
        onOpenChange={setDispatchOpen}
        onConfirm={handleDispatch}
      />
    </PageShell>
  )
}
