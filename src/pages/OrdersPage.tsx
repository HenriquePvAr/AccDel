import {
  Bike,
  CheckCircle2,
  ClipboardList,
  CookingPot,
  RefreshCcw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { DispatchOrderDialog } from '@/features/orders/components/DispatchOrderDialog'
import { OrderGroupColumn } from '@/features/orders/components/OrderGroupColumn'
import { OrderFilters } from '@/features/orders/components/OrderFilters'
import { OrderSummaryCards } from '@/features/orders/components/OrderSummaryCards'
import type { OrderAction } from '@/features/orders/components/order-actions'
import {
  useDriversQuery,
  useOrdersQuery,
  useUpdateOrderStatusMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { useAutoAcceptStore, useOrderFiltersStore } from '@/stores'
import type { Order, OrderChannel, OrderStatus, PaymentMethod } from '@/types'

const statusTabs: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'in_analysis', label: 'Em analise' },
  { value: 'in_preparation', label: 'Em preparo' },
  { value: 'ready', label: 'Prontos' },
  { value: 'out_for_delivery', label: 'Em rota' },
  { value: 'completed', label: 'Finalizados' },
]

const emptySummary = {
  totalOpen: 0,
  delayed: 0,
  ready: 0,
  routing: 0,
}

const boardGroups: Array<{
  key: 'production' | 'route' | 'ready'
  title: string
  subtitle: string
  statuses: OrderStatus[]
  icon: typeof CookingPot
  tone: 'orange' | 'blue' | 'green'
}> = [
  {
    key: 'production',
    title: 'Producao',
    subtitle: 'Analise, aceite e preparo',
    statuses: ['in_analysis', 'in_preparation'],
    icon: CookingPot,
    tone: 'orange',
  },
  {
    key: 'route',
    title: 'Em rota',
    subtitle: 'Despachos e entregas ativas',
    statuses: ['out_for_delivery'],
    icon: Bike,
    tone: 'blue',
  },
  {
    key: 'ready',
    title: 'Pronto',
    subtitle: 'Prontos, concluidos e cancelados',
    statuses: ['ready', 'completed', 'cancelled'],
    icon: CheckCircle2,
    tone: 'green',
  },
]

function countByStatus(orders: Order[], status: OrderStatus) {
  return orders.filter((order) => order.status === status).length
}

export function OrdersPage() {
  usePageTitle('Pedidos / Delivery')
  const navigate = useNavigate()
  const search = useOrderFiltersStore((state) => state.search)
  const source = useOrderFiltersStore((state) => state.source)
  const status = useOrderFiltersStore((state) => state.status)
  const paymentMethod = useOrderFiltersStore((state) => state.paymentMethod)
  const delayedOnly = useOrderFiltersStore((state) => state.delayedOnly)
  const setSearch = useOrderFiltersStore((state) => state.setSearch)
  const setSource = useOrderFiltersStore((state) => state.setSource)
  const setStatus = useOrderFiltersStore((state) => state.setStatus)
  const setPaymentMethod = useOrderFiltersStore((state) => state.setPaymentMethod)
  const setDelayedOnly = useOrderFiltersStore((state) => state.setDelayedOnly)
  const autoAcceptEnabled = useAutoAcceptStore((state) => state.enabled)
  const setAutoAcceptEnabled = useAutoAcceptStore((state) => state.setEnabled)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [pendingDispatchOrderId, setPendingDispatchOrderId] = useState<string | null>(null)
  const canUpdateOrders = useCan('orders:update')

  const ordersQuery = useOrdersQuery({
    filters: {
      search,
      source,
      status,
      paymentMethod,
      delayedOnly,
    },
  })
  const countsQuery = useOrdersQuery({
    filters: {
      search,
      source,
      status: 'all',
      paymentMethod,
      delayedOnly,
    },
  })
  const driversQuery = useDriversQuery()
  const updateOrderStatus = useUpdateOrderStatusMutation()

  const visibleOrders = ordersQuery.data?.data ?? []
  const countOrders = countsQuery.data?.data ?? visibleOrders
  const stats = countsQuery.data?.summary ?? ordersQuery.data?.summary ?? emptySummary
  const drivers = useMemo(() => driversQuery.data?.data ?? [], [driversQuery.data?.data])
  const dispatchableDrivers = useMemo(
    () => drivers.filter((driver) => (driver.active ?? true) && driver.availability !== 'paused'),
    [drivers],
  )
  const pendingDispatchOrder =
    visibleOrders.find((order) => order.id === pendingDispatchOrderId) ??
    countOrders.find((order) => order.id === pendingDispatchOrderId) ??
    null

  const tabs = statusTabs.map((tab) => ({
    ...tab,
    count: tab.value === 'all' ? countOrders.length : countByStatus(countOrders, tab.value),
  }))
  const boardColumns = boardGroups.map((group) => ({
    ...group,
    orders: visibleOrders.filter((order) => group.statuses.includes(order.status)),
  }))

  const handleAction = (orderId: string, action: OrderAction) => {
    if (!canUpdateOrders) {
      return
    }

    if (action === 'cancel') {
      setPendingCancelId(orderId)
      return
    }

    if (action === 'dispatch') {
      setPendingDispatchOrderId(orderId)
      return
    }

    updateOrderStatus.mutate({
      orderId,
      action,
      actor: action === 'ready' ? 'Cozinha' : 'Operacao',
    })
  }

  const handleDispatch = (driverId: string) => {
    if (!pendingDispatchOrderId || !canUpdateOrders) {
      return
    }

    updateOrderStatus.mutate(
      {
        orderId: pendingDispatchOrderId,
        action: 'dispatch',
        driverId,
      },
      {
        onSuccess: () => {
          setPendingDispatchOrderId(null)
        },
      },
    )
  }

  return (
    <PageShell className="text-slate-100">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-400">Acompanhe pedidos em tempo real</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Pedidos / Delivery
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Fluxo operacional para aceite, preparo, despacho e entrega sem poluir a leitura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <span>
              <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                Autoaceite
              </span>
              <span className="text-sm font-bold text-slate-100">
                {autoAcceptEnabled ? 'Ativado' : 'Manual'}
              </span>
            </span>
            <Switch checked={autoAcceptEnabled} onCheckedChange={setAutoAcceptEnabled} />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => ordersQuery.refetch()}
            disabled={ordersQuery.isFetching}
            className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
          >
            <RefreshCcw className={ordersQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Atualizar
          </Button>
        </div>
      </header>

          <div className="space-y-5">
            <OrderSummaryCards stats={stats} />

            <OrderFilters
              search={search}
              source={source}
              status={status}
              paymentMethod={paymentMethod}
              delayedOnly={delayedOnly}
              tabs={tabs}
              onSearchChange={setSearch}
              onSourceChange={(value) => setSource(value as OrderChannel | 'all')}
              onStatusChange={(value) => setStatus(value as OrderStatus | 'all')}
              onPaymentMethodChange={(value) => setPaymentMethod(value as PaymentMethod | 'all')}
              onDelayedOnlyChange={setDelayedOnly}
            />

            {ordersQuery.isLoading ? (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[22px] border border-white/10 bg-[#061525]/76 p-4"
                  >
                    <Skeleton className="mb-3 h-8 w-64 bg-white/10" />
                    <div className="space-y-2.5">
                      <Skeleton className="h-32 rounded-[18px] bg-white/10" />
                      <Skeleton className="h-32 rounded-[18px] bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : ordersQuery.isError ? (
              <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-8 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-red-300" />
                <h2 className="mt-4 text-xl font-black text-white">Nao foi possivel carregar pedidos</h2>
                <p className="mt-2 text-sm text-red-100/80">
                  Verifique a conexao com a API e tente atualizar a operacao.
                </p>
                <Button
                  type="button"
                  onClick={() => ordersQuery.refetch()}
                  className="mt-5 rounded-xl bg-red-600 text-white hover:bg-red-500"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : visibleOrders.length ? (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {boardColumns.map((column) => (
                  <OrderGroupColumn
                    key={column.key}
                    title={column.title}
                    subtitle={column.subtitle}
                    orders={column.orders}
                    icon={column.icon}
                    tone={column.tone}
                    onOpen={(orderId) => navigate(`/orders/${orderId}`)}
                    onAction={handleAction}
                    canUpdate={canUpdateOrders}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-[#071a2d]/80 p-8">
                <EmptyState
                  icon={<ClipboardList className="h-5 w-5" />}
                  title="Nenhum pedido encontrado"
                  description="Ajuste busca, filtros ou periodo para encontrar pedidos deste fluxo."
                />
              </div>
            )}
          </div>

      <DispatchOrderDialog
        open={Boolean(pendingDispatchOrderId)}
        order={pendingDispatchOrder}
        drivers={dispatchableDrivers}
        busy={updateOrderStatus.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDispatchOrderId(null)
          }
        }}
        onConfirm={handleDispatch}
      />

      <ConfirmActionDialog
        open={Boolean(pendingCancelId)}
        title="Cancelar pedido"
        description="Essa acao registra o cancelamento no historico e remove o pedido do fluxo operacional."
        confirmLabel="Cancelar pedido"
        onOpenChange={(open) => {
          if (!open) {
            setPendingCancelId(null)
          }
        }}
        onConfirm={() => {
          if (pendingCancelId) {
            updateOrderStatus.mutate(
              {
                orderId: pendingCancelId,
                action: 'cancel',
                actor: 'Operacao',
              },
              {
                onSuccess: () => {
                  setPendingCancelId(null)
                },
              },
            )
          }
        }}
      />
    </PageShell>
  )
}
