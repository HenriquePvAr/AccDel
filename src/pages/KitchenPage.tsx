import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BellRing,
  Bike,
  ChefHat,
  CheckCircle2,
  Clock3,
  Flame,
  MapPin,
  PackageCheck,
  RefreshCcw,
  ShoppingBag,
  Store,
  TimerReset,
  UtensilsCrossed,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { OrderTimeline } from '@/features/orders/components/OrderTimeline'
import { useKitchenQueueQuery, useMarkKitchenOrderReadyMutation } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { channelLabelMap } from '@/lib/domain'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { KitchenQueueFilters } from '@/contracts'
import type { Order, OrderChannel } from '@/types'

type KitchenChannelFilter = OrderChannel | 'all'
type KitchenViewFilter = 'all' | 'urgent' | 'priority'
type KitchenRisk = 'on_time' | 'warning' | 'late'

const channelFilters: Array<{
  value: KitchenChannelFilter
  label: string
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'dine_in', label: 'Salao' },
  { value: 'counter', label: 'Balcao' },
  { value: 'pickup', label: 'Retirada' },
]

const riskCopy: Record<KitchenRisk, { label: string; className: string }> = {
  on_time: {
    label: 'No tempo',
    className: 'bg-emerald-400/12 text-emerald-300 ring-emerald-300/20',
  },
  warning: {
    label: 'Perto do limite',
    className: 'bg-amber-400/12 text-amber-300 ring-amber-300/20',
  },
  late: {
    label: 'Atrasado',
    className: 'bg-red-400/12 text-red-300 ring-red-300/20',
  },
}

export function KitchenPage() {
  usePageTitle('Cozinha')
  const [channel, setChannel] = useState<KitchenChannelFilter>('all')
  const [view, setView] = useState<KitchenViewFilter>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const canUpdateKitchen = useCan('kitchen:update')
  const filters = useMemo<KitchenQueueFilters>(
    () => ({
      channel,
      urgentOnly: view === 'urgent',
      priorityOnly: view === 'priority',
    }),
    [channel, view],
  )
  const kitchenQueue = useKitchenQueueQuery({ filters })
  const markReady = useMarkKitchenOrderReadyMutation()
  const queue = kitchenQueue.data?.data
  const production = queue?.production ?? []
  const ready = queue?.ready ?? []
  const urgent = queue?.urgent ?? []

  const handleMarkReady = (order: Order) => {
    if (!canUpdateKitchen || order.status === 'ready') {
      return
    }

    markReady.mutate(
      {
        orderId: order.id,
        actor: 'Cozinha',
      },
      {
        onSuccess: (response) => {
          setSelectedOrder((current) =>
            current?.id === response.data.id ? response.data : current,
          )
        },
      },
    )
  }

  return (
    <PageShell>
      <SectionHeader
        eyebrow="KDS operacional"
        title="Cozinha"
        description="Fila de producao com SLA, prioridade, canal e pronto para despacho/retirada/servico."
        actions={
          <Button
            variant="outline"
            onClick={() => kitchenQueue.refetch()}
            disabled={kitchenQueue.isFetching}
            className="h-11 rounded-2xl"
          >
            <RefreshCcw className={cn('h-4 w-4', kitchenQueue.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KitchenMetricCard
          icon={<ChefHat className="h-5 w-5" />}
          label="Em producao"
          value={queue?.summary.inProduction ?? 0}
          hint="Pedidos em preparo"
          tone="amber"
        />
        <KitchenMetricCard
          icon={<BellRing className="h-5 w-5" />}
          label="Urgentes"
          value={queue?.summary.urgent ?? 0}
          hint="SLA perto ou estourado"
          tone="red"
        />
        <KitchenMetricCard
          icon={<PackageCheck className="h-5 w-5" />}
          label="Prontos"
          value={queue?.summary.ready ?? 0}
          hint="Aguardando saida/servico"
          tone="green"
        />
        <KitchenMetricCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Itens na fila"
          value={queue?.summary.totalItems ?? 0}
          hint="Volume operacional"
          tone="blue"
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
                Filtros da cozinha
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Foque por canal ou deixe apenas pedidos que precisam de atencao.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={view === 'all'} onClick={() => setView('all')}>
                Todos
              </FilterPill>
              <FilterPill active={view === 'urgent'} onClick={() => setView('urgent')}>
                Atrasados / urgentes
              </FilterPill>
              <FilterPill active={view === 'priority'} onClick={() => setView('priority')}>
                Prioridade
              </FilterPill>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {channelFilters.map((entry) => (
              <FilterPill
                key={entry.value}
                active={channel === entry.value}
                onClick={() => setChannel(entry.value)}
              >
                {entry.label}
              </FilterPill>
            ))}
          </div>
        </CardContent>
      </Card>

      {kitchenQueue.isLoading ? (
        <div className="grid gap-5 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[520px] rounded-[28px] bg-white/10" />
          ))}
        </div>
      ) : kitchenQueue.isError ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Falha ao carregar a cozinha"
          description="Nao foi possivel carregar a fila KDS agora. Tente atualizar ou revise a API."
        />
      ) : queue?.all.length ? (
        <div className="grid items-start gap-5 xl:grid-cols-[0.9fr_1.15fr_0.95fr]">
          <KitchenColumn
            icon={<Flame className="h-5 w-5" />}
            title="Atrasados / urgentes"
            description="Pedidos com SLA critico ou prioridade alta."
            count={urgent.length}
            accent="red"
          >
            {urgent.length ? (
              urgent.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  compact
                  busy={markReady.isPending}
                  canUpdate={canUpdateKitchen}
                  onDetails={setSelectedOrder}
                  onMarkReady={handleMarkReady}
                />
              ))
            ) : (
              <ColumnEmptyState label="Sem pedido critico neste filtro." />
            )}
          </KitchenColumn>

          <KitchenColumn
            icon={<ChefHat className="h-5 w-5" />}
            title="Em producao"
            description="Pedidos aceitos e em preparo na cozinha."
            count={production.length}
            accent="amber"
          >
            {production.length ? (
              production.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  busy={markReady.isPending}
                  canUpdate={canUpdateKitchen}
                  onDetails={setSelectedOrder}
                  onMarkReady={handleMarkReady}
                />
              ))
            ) : (
              <ColumnEmptyState label="Nenhum pedido em producao." />
            )}
          </KitchenColumn>

          <KitchenColumn
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Prontos"
            description="Pronto para despacho, retirada ou servir."
            count={ready.length}
            accent="green"
          >
            {ready.length ? (
              ready.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  busy={markReady.isPending}
                  canUpdate={canUpdateKitchen}
                  onDetails={setSelectedOrder}
                  onMarkReady={handleMarkReady}
                />
              ))
            ) : (
              <ColumnEmptyState label="Nada pronto aguardando saida." />
            )}
          </KitchenColumn>
        </div>
      ) : (
        <EmptyState
          icon={<ChefHat className="h-5 w-5" />}
          title="Cozinha sem fila ativa"
          description="Ao aceitar um pedido ou criar pedido direto para producao, ele aparece aqui com SLA, itens e canal."
        />
      )}

      <KitchenOrderDrawer
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        busy={markReady.isPending}
        canUpdate={canUpdateKitchen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null)
          }
        }}
        onMarkReady={handleMarkReady}
      />
    </PageShell>
  )
}

function KitchenMetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode
  label: string
  value: number
  hint: string
  tone: 'amber' | 'red' | 'green' | 'blue'
}) {
  const toneClass = {
    amber: 'bg-amber-400/12 text-amber-300 ring-amber-300/20',
    red: 'bg-red-400/12 text-red-300 ring-red-300/20',
    green: 'bg-emerald-400/12 text-emerald-300 ring-emerald-300/20',
    blue: 'bg-blue-400/12 text-blue-300 ring-blue-300/20',
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl ring-1', toneClass)}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-1 font-mono text-3xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 rounded-2xl px-4 text-sm font-black transition',
        active
          ? 'bg-primary text-white shadow-[0_12px_30px_rgba(198,93,46,0.24)]'
          : 'bg-white/[0.04] text-slate-300 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function KitchenColumn({
  icon,
  title,
  description,
  count,
  accent,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  count: number
  accent: 'amber' | 'red' | 'green'
  children: ReactNode
}) {
  const accentClass = {
    amber: 'text-amber-300 bg-amber-400/10 ring-amber-300/20',
    red: 'text-red-300 bg-red-400/10 ring-red-300/20',
    green: 'text-emerald-300 bg-emerald-400/10 ring-emerald-300/20',
  }[accent]

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#050d19]/84 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl ring-1', accentClass)}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">{title}</h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs font-black text-slate-300 ring-1 ring-white/10">
                {count}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </header>

      <div className="space-y-3">{children}</div>
    </section>
  )
}

function KitchenOrderCard({
  order,
  compact = false,
  busy,
  canUpdate,
  onDetails,
  onMarkReady,
}: {
  order: Order
  compact?: boolean
  busy: boolean
  canUpdate: boolean
  onDetails: (order: Order) => void
  onMarkReady: (order: Order) => void
}) {
  const risk = getKitchenRisk(order)
  const operation = getOperationContext(order)
  const items = order.items.slice(0, compact ? 3 : 5)
  const remainingItems = order.items.length - items.length
  const prepTarget = getPrepTargetMinutes(order)
  const elapsedMinutes = getElapsedMinutes(order)
  const remainingMinutes = Math.max(0, prepTarget - elapsedMinutes)
  const prepProgress = Math.min(100, Math.round((elapsedMinutes / prepTarget) * 100))

  return (
    <article
      className={cn(
        'rounded-[24px] border bg-[#071525]/92 p-4 ring-1 transition hover:-translate-y-0.5',
        risk === 'late'
          ? 'border-red-300/25 ring-red-300/15'
          : risk === 'warning'
            ? 'border-amber-300/25 ring-amber-300/15'
            : 'border-white/10 ring-white/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xl font-black text-white">{order.number}</p>
            <OrderStatusBadge status={order.status} />
            <span
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ring-1',
                riskCopy[risk].className,
              )}
            >
              {riskCopy[risk].label}
            </span>
          </div>
          <p className="mt-2 truncate text-sm font-bold text-slate-100">{operation.title}</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-400">
            {operation.icon}
            {operation.detail}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-black text-white">{elapsedMinutes} min</p>
          <p className="text-xs text-slate-500">decorridos</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/[0.035] px-3 py-2 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-black uppercase tracking-[0.14em] text-slate-500">
            SLA preparo
          </span>
          <span className={cn('font-mono font-black', risk === 'late' ? 'text-red-300' : 'text-slate-300')}>
            {remainingMinutes > 0 ? `${remainingMinutes} min restantes` : 'limite estourado'}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              risk === 'late'
                ? 'bg-red-400'
                : risk === 'warning'
                  ? 'bg-amber-300'
                  : 'bg-emerald-300',
            )}
            style={{ width: `${prepProgress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-bold text-white">
                {item.quantity}x {item.name}
              </p>
              <span className="font-mono text-xs text-slate-400">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </div>
            {item.notes ? <p className="mt-1 line-clamp-1 text-xs text-amber-200">{item.notes}</p> : null}
          </div>
        ))}
        {remainingItems > 0 ? (
          <p className="px-1 text-xs font-semibold text-slate-500">
            +{remainingItems} item(ns) no detalhe
          </p>
        ) : null}
      </div>

      {order.notes ? (
        <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/8 px-3 py-2 text-xs text-amber-100">
          <span className="font-black">Obs: </span>
          <span className="line-clamp-2">{order.notes}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <InfoChip icon={<Clock3 className="h-3.5 w-3.5" />} label={formatDateTime(order.createdAt)} />
        <InfoChip
          icon={<TimerReset className="h-3.5 w-3.5" />}
          label={`Meta ${prepTarget} min`}
        />
        <InfoChip icon={<PackageCheck className="h-3.5 w-3.5" />} label={getReadyDestination(order)} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => onDetails(order)}
        >
          Detalhes
        </Button>
        {order.status === 'in_preparation' ? (
          <Button
            size="sm"
            disabled={!canUpdate || busy}
            className="h-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => onMarkReady(order)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Marcar pronto
          </Button>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-400/10 px-3 text-xs font-black text-emerald-300 ring-1 ring-emerald-300/20">
            {getReadyDestination(order)}
          </span>
        )}
      </div>
    </article>
  )
}

function KitchenOrderDrawer({
  order,
  open,
  busy,
  canUpdate,
  onOpenChange,
  onMarkReady,
}: {
  order: Order | null
  open: boolean
  busy: boolean
  canUpdate: boolean
  onOpenChange: (open: boolean) => void
  onMarkReady: (order: Order) => void
}) {
  if (!order) {
    return null
  }

  const operation = getOperationContext(order)
  const risk = getKitchenRisk(order)
  const elapsedMinutes = getElapsedMinutes(order)
  const prepTarget = getPrepTargetMinutes(order)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[640px] overflow-y-auto">
        <SheetHeader className="pr-10">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <OrderStatusBadge channel={order.source} />
            <span
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ring-1',
                riskCopy[risk].className,
              )}
            >
              {riskCopy[risk].label}
            </span>
          </div>
          <SheetTitle className="text-2xl font-black">
            {order.number} · {operation.title}
          </SheetTitle>
          <SheetDescription>
            Criado em {formatDateTime(order.createdAt)} · {elapsedMinutes} min em produção
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4">
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
              <DrawerMetric label="Canal" value={channelLabelMap[order.source]} />
              <DrawerMetric
                label="Meta preparo"
                value={`${prepTarget} min`}
              />
              <DrawerMetric
                label="SLA agora"
                value={elapsedMinutes >= prepTarget ? 'Atrasado' : `${prepTarget - elapsedMinutes} min restantes`}
              />
              <DrawerMetric label="Destino" value={getReadyDestination(order)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-black text-white">Contexto operacional</h3>
              <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10">
                <p className="font-bold text-white">{operation.title}</p>
                <p className="mt-1">{operation.detail}</p>
                {order.customerPhone ? <p className="mt-1">Telefone: {order.customerPhone}</p> : null}
              </div>
              {order.notes ? (
                <div className="rounded-2xl border border-amber-300/15 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
                  <p className="font-black">Observacao geral</p>
                  <p className="mt-1">{order.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-black text-white">Itens para producao</h3>
              {order.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">
                        {item.quantity}x {item.name}
                      </p>
                      {item.options.length ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {item.options.map((option) => option.name).join(', ')}
                        </p>
                      ) : null}
                    </div>
                    <span className="font-mono text-sm text-slate-300">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                  {item.notes ? (
                    <p className="mt-2 rounded-xl bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <h3 className="font-black text-white">Linha do tempo</h3>
              <OrderTimeline order={order} compact />
            </CardContent>
          </Card>
        </div>

        <div className="sticky bottom-0 -mx-6 mt-2 border-t border-white/10 bg-[#07111f]/95 px-6 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {order.status === 'in_preparation' ? (
              <Button
                disabled={!canUpdate || busy}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => onMarkReady(order)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar pedido pronto
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DrawerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function InfoChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl bg-white/[0.04] px-2.5 py-2 ring-1 ring-white/10">
      <span className="text-slate-500">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

function ColumnEmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  )
}

function getKitchenRisk(order: Order): KitchenRisk {
  const targetMinutes = getPrepTargetMinutes(order)
  const elapsedMinutes = getElapsedMinutes(order)

  if (order.delayed || elapsedMinutes >= targetMinutes) {
    return 'late'
  }

  if (order.priority !== 'normal' || elapsedMinutes >= targetMinutes * 0.8) {
    return 'warning'
  }

  return 'on_time'
}

function getElapsedMinutes(order: Order) {
  const startedAt = getProductionStartedAt(order)
  return Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
}

function getPrepTargetMinutes(order: Order) {
  return order.estimatedPrepTimeMinutes ?? order.estimatedTotalTimeMinutes ?? 30
}

function getProductionStartedAt(order: Order) {
  return (
    order.timeline.find((entry) => {
      const label = entry.label.toLowerCase()
      return (
        label.includes('producao') ||
        label.includes('preparo') ||
        label.includes('aceito')
      )
    })?.at ?? order.createdAt
  )
}

function getOperationContext(order: Order) {
  if (order.source === 'dine_in') {
    const hasNamedCustomer = Boolean(order.customerName && order.customerName !== order.tableCode)

    return {
      title: order.tableCode ?? 'Salao sem mesa',
      detail: hasNamedCustomer ? `Cliente: ${order.customerName}` : 'Comanda de salao',
      icon: <UtensilsCrossed className="h-3.5 w-3.5 text-amber-300" />,
    }
  }

  if (order.source === 'delivery') {
    return {
      title: order.customerName,
      detail: order.addressText ?? order.addressLabel ?? 'Endereco nao informado',
      icon: <Bike className="h-3.5 w-3.5 text-blue-300" />,
    }
  }

  if (order.source === 'pickup') {
    return {
      title: order.customerName,
      detail: 'Retirada no balcao',
      icon: <ShoppingBag className="h-3.5 w-3.5 text-emerald-300" />,
    }
  }

  if (order.source === 'counter') {
    return {
      title: order.customerName,
      detail: 'Pedido de balcao',
      icon: <Store className="h-3.5 w-3.5 text-orange-300" />,
    }
  }

  return {
    title: order.customerName,
    detail: channelLabelMap[order.source],
    icon: <MapPin className="h-3.5 w-3.5 text-slate-300" />,
  }
}

function getReadyDestination(order: Order) {
  if (order.source === 'delivery') {
    return 'Pronto p/ despacho'
  }

  if (order.source === 'dine_in') {
    return 'Pronto p/ servir'
  }

  if (order.source === 'pickup') {
    return 'Pronto p/ retirada'
  }

  if (order.source === 'counter') {
    return 'Pronto p/ balcao'
  }

  return 'Pronto'
}
