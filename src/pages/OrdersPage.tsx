import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  ClipboardList,
  CreditCard,
  Filter,
  MapPin,
  Package,
  RefreshCcw,
  Route,
  StickyNote,
  Wifi,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DispatchOrderDialog } from '@/features/orders/components/DispatchOrderDialog'
import { OrderDrawer } from '@/features/orders/components/OrderDrawer'
import type { OrderAction } from '@/features/orders/components/order-actions'
import {
  getOrderItemCountLabel,
  getPrimaryOrderAction,
} from '@/features/orders/components/order-ui'
import {
  getOperationalStatuses,
  getOrderTiming,
  getVisibleOperationalItems,
  isOrderLate,
  isStatusInOperationalView,
  type OperationalStatus,
  type OperationalView,
} from '@/features/orders/operations-board'
import {
  useDriversQuery,
  useOrderByIdQuery,
  useOrdersQuery,
  useUpdateOrderStatusMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDriversStore, useOrderFiltersStore } from '@/stores'
import type { Driver, Order, OrderChannel, OrderStatus } from '@/types'

type KanbanStatus = OperationalStatus
type KanbanStatusFilter = KanbanStatus | 'all'
type SourceFilter = Extract<OrderChannel, 'delivery' | 'counter' | 'pickup'> | 'all'
type SortOption = 'recent' | 'oldest' | 'delayed'

interface KanbanColumnConfig {
  status: KanbanStatus
  title: string
  mobileTitle: string
  description: string
  tone: 'cyan' | 'orange' | 'green' | 'blue' | 'neutral'
  dotClass: string
}

const kanbanColumnByStatus: Record<KanbanStatus, KanbanColumnConfig> = {
  in_analysis: {
    status: 'in_analysis',
    title: 'Em analise',
    mobileTitle: 'Analise',
    description: 'Pedidos aguardando aceite.',
    tone: 'cyan',
    dotClass: 'bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.42)]',
  },
  in_preparation: {
    status: 'in_preparation',
    title: 'Producao',
    mobileTitle: 'Producao',
    description: 'Pedidos em preparo na cozinha.',
    tone: 'orange',
    dotClass: 'bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.42)]',
  },
  ready: {
    status: 'ready',
    title: 'Pronto',
    mobileTitle: 'Pronto',
    description: 'Aguardando despacho ou retirada.',
    tone: 'green',
    dotClass: 'bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.42)]',
  },
  out_for_delivery: {
    status: 'out_for_delivery',
    title: 'Em rota',
    mobileTitle: 'Em rota',
    description: 'Entregas em andamento.',
    tone: 'blue',
    dotClass: 'bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.42)]',
  },
  completed: {
    status: 'completed',
    title: 'Concluidos recentes',
    mobileTitle: 'Concluidos',
    description: 'Ultimos pedidos encerrados.',
    tone: 'neutral',
    dotClass: 'bg-slate-400 shadow-[0_0_18px_rgba(148,163,184,0.25)]',
  },
}

const summaryIconByStatus: Record<KanbanStatus, ReactNode> = {
  in_analysis: <ClipboardList className="h-4 w-4" />,
  in_preparation: <Clock3 className="h-4 w-4" />,
  ready: <CheckCircle2 className="h-4 w-4" />,
  out_for_delivery: <Bike className="h-4 w-4" />,
  completed: <CircleDot className="h-4 w-4" />,
}

const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'counter', label: 'Balcao' },
  { value: 'pickup', label: 'Retirada' },
]

const statusOptions: Array<{ value: KanbanStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'in_analysis', label: 'Em analise' },
  { value: 'in_preparation', label: 'Producao' },
  { value: 'ready', label: 'Pronto' },
  { value: 'out_for_delivery', label: 'Em rota' },
  { value: 'completed', label: 'Concluido' },
]

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'recent', label: 'Mais recente' },
  { value: 'oldest', label: 'Mais antigo' },
  { value: 'delayed', label: 'Mais atrasado' },
]

const emptyOrders: Order[] = []
const emptyDrivers: Driver[] = []
const visiblePerColumn = 6
const paymentStatusLabel: Record<Order['paymentStatus'], string> = {
  paid: 'Pago',
  pending: 'Pendente',
  refunded: 'Estornado',
}

function isKanbanStatus(value: OrderStatus | 'all'): value is KanbanStatusFilter {
  return (
    value === 'all' ||
    value === 'in_analysis' ||
    value === 'in_preparation' ||
    value === 'ready' ||
    value === 'out_for_delivery' ||
    value === 'completed'
  )
}

function isSourceFilter(value: OrderChannel | 'all'): value is SourceFilter {
  return value === 'all' || value === 'delivery' || value === 'counter' || value === 'pickup'
}

function matchesSearch(order: Order, search: string) {
  const query = search.trim().toLowerCase()

  if (!query) {
    return true
  }

  const haystack = [
    order.number,
    order.customerName,
    order.customerPhone,
    order.addressText,
    order.addressLabel,
    order.tableCode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function sortOrders(orders: Order[], sortBy: SortOption) {
  return orders.slice().sort((left, right) => {
    if (sortBy === 'oldest') {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    }

    if (sortBy === 'delayed') {
      const delayedDelta = Number(right.delayed) - Number(left.delayed)

      if (delayedDelta !== 0) {
        return delayedDelta
      }

      return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function buildOrderAddress(order: Order) {
  return order.source === 'delivery'
    ? order.addressText ?? order.addressLabel ?? 'Endereco nao informado'
    : order.tableCode ?? channelLabelMap[order.source]
}

function buildColumnToneClasses(tone: KanbanColumnConfig['tone']) {
  if (tone === 'cyan') {
    return {
      ring: 'ring-sky-400/20',
      text: 'text-sky-300',
      border: 'border-sky-400/20',
      selected: 'border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_18px_46px_rgba(14,165,233,0.16)]',
      button: 'border-sky-400/35 bg-sky-500/10 text-sky-200 hover:bg-sky-500/16',
    }
  }

  if (tone === 'orange') {
    return {
      ring: 'ring-orange-400/20',
      text: 'text-orange-300',
      border: 'border-orange-400/20',
      selected: 'border-orange-400/80 shadow-[0_0_0_1px_rgba(251,146,60,0.48),0_18px_46px_rgba(249,115,22,0.14)]',
      button: 'border-orange-400/35 bg-orange-500/10 text-orange-200 hover:bg-orange-500/16',
    }
  }

  if (tone === 'blue') {
    return {
      ring: 'ring-blue-400/20',
      text: 'text-blue-300',
      border: 'border-blue-400/20',
      selected: 'border-blue-400/80 shadow-[0_0_0_1px_rgba(96,165,250,0.48),0_18px_46px_rgba(59,130,246,0.14)]',
      button: 'border-blue-400/35 bg-blue-500/10 text-blue-200 hover:bg-blue-500/16',
    }
  }

  if (tone === 'neutral') {
    return {
      ring: 'ring-slate-400/15',
      text: 'text-slate-300',
      border: 'border-slate-400/15',
      selected: 'border-slate-300/60 shadow-[0_0_0_1px_rgba(203,213,225,0.28),0_18px_46px_rgba(15,23,42,0.18)]',
      button: 'border-slate-400/25 bg-slate-500/10 text-slate-200 hover:bg-slate-500/16',
    }
  }

  return {
    ring: 'ring-emerald-400/20',
    text: 'text-emerald-300',
    border: 'border-emerald-400/20',
    selected: 'border-emerald-400/80 shadow-[0_0_0_1px_rgba(52,211,153,0.45),0_18px_46px_rgba(16,185,129,0.14)]',
    button: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/16',
  }
}

export function OrdersPage() {
  usePageTitle('Central de pedidos')
  const navigate = useNavigate()
  const search = useOrderFiltersStore((state) => state.search)
  const storedSource = useOrderFiltersStore((state) => state.source)
  const storedStatus = useOrderFiltersStore((state) => state.status)
  const delayedOnly = useOrderFiltersStore((state) => state.delayedOnly)
  const setSearch = useOrderFiltersStore((state) => state.setSearch)
  const setSource = useOrderFiltersStore((state) => state.setSource)
  const setStatus = useOrderFiltersStore((state) => state.setStatus)
  const setDelayedOnly = useOrderFiltersStore((state) => state.setDelayedOnly)
  const resetFilters = useOrderFiltersStore((state) => state.reset)
  const setSelectedDriverId = useDriversStore((state) => state.setSelectedDriverId)
  const canUpdateOrders = useCan('orders:update')
  const canTrackDeliveries = useCan('drivers:view')
  const selectedSource = isSourceFilter(storedSource) ? storedSource : 'all'
  const selectedStatus = isKanbanStatus(storedStatus) ? storedStatus : 'all'
  const [operationalView, setOperationalView] = useState<OperationalView>('preparation')
  const [activeMobileStatus, setActiveMobileStatus] = useState<KanbanStatus>('in_analysis')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [pendingDispatchOrderId, setPendingDispatchOrderId] = useState<string | null>(null)
  const [expandedColumns, setExpandedColumns] = useState<Record<KanbanStatus, boolean>>({
    in_analysis: false,
    in_preparation: false,
    ready: false,
    out_for_delivery: false,
    completed: false,
  })
  const filterRef = useRef<HTMLDivElement | null>(null)
  const activeColumns = useMemo(
    () => getOperationalStatuses(operationalView).map((status) => kanbanColumnByStatus[status]),
    [operationalView],
  )
  const availableStatusOptions = useMemo(
    () =>
      statusOptions.filter(
        (option) => option.value === 'all' || isStatusInOperationalView(option.value, operationalView),
      ),
    [operationalView],
  )

  const ordersQuery = useOrdersQuery({
    filters: {
      pageSize: 100,
      source: selectedSource,
      status: 'all',
    },
  })
  const selectedOrderQuery = useOrderByIdQuery(selectedOrderId)
  const driversQuery = useDriversQuery()
  const updateOrderStatus = useUpdateOrderStatusMutation()

  const allOrders = ordersQuery.data?.data ?? emptyOrders
  const searchedOrders = useMemo(
    () => sortOrders(allOrders.filter((order) => matchesSearch(order, search)), sortBy),
    [allOrders, search, sortBy],
  )
  const boardOrders = useMemo(
    () =>
      searchedOrders.filter(
        (order) =>
          isStatusInOperationalView(order.status, operationalView) &&
          (selectedStatus === 'all' || order.status === selectedStatus) &&
          (!delayedOnly || isOrderLate(order)),
      ),
    [delayedOnly, operationalView, searchedOrders, selectedStatus],
  )
  const counts = useMemo(
    () => ({
      in_analysis: searchedOrders.filter((order) => order.status === 'in_analysis').length,
      in_preparation: searchedOrders.filter((order) => order.status === 'in_preparation').length,
      ready: searchedOrders.filter((order) => order.status === 'ready').length,
      out_for_delivery: searchedOrders.filter((order) => order.status === 'out_for_delivery').length,
      completed: searchedOrders.filter((order) => order.status === 'completed').length,
      delayed: searchedOrders.filter(
        (order) => isStatusInOperationalView(order.status, operationalView) && isOrderLate(order),
      ).length,
    }),
    [operationalView, searchedOrders],
  )
  const selectedOrder =
    selectedOrderQuery.data?.data ??
    allOrders.find((order) => order.id === selectedOrderId) ??
    null
  const drivers = driversQuery.data?.data ?? emptyDrivers
  const dispatchableDrivers = drivers.filter(
    (driver) => (driver.active ?? true) && driver.availability !== 'paused',
  )
  const pendingDispatchOrder =
    allOrders.find((order) => order.id === pendingDispatchOrderId) ??
    selectedOrder ??
    null

  useEffect(() => {
    if (!filtersOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Element && target.closest('[data-orders-filter-select="true"]')) {
        return
      }

      if (target instanceof Node && !filterRef.current?.contains(target)) {
        setFiltersOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [filtersOpen])

  const handleRefresh = () => {
    void ordersQuery.refetch()
    if (selectedOrderId) {
      void selectedOrderQuery.refetch()
    }
  }

  const handleOperationalViewChange = (view: OperationalView) => {
    setOperationalView(view)
    setActiveMobileStatus(getOperationalStatuses(view)[0])

    if (selectedStatus !== 'all' && !isStatusInOperationalView(selectedStatus, view)) {
      setStatus('all')
    }
  }

  const handleStatusSummaryClick = (status: KanbanStatus) => {
    setDelayedOnly(false)
    setStatus(selectedStatus === status ? 'all' : status)
    setActiveMobileStatus(status)
  }

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

  const handleTrackDelivery = (order: Order) => {
    if (order.driverId) {
      setSelectedDriverId(order.driverId)
    }

    navigate('/drivers/location')
  }

  const clearFilters = () => {
    resetFilters()
    setSortBy('recent')
    setFiltersOpen(false)
  }

  return (
    <PageShell className="min-h-[calc(100vh-72px)] space-y-3 overflow-hidden pt-4 text-slate-100">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
              Operacao ao vivo
            </p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Central de pedidos</h1>
          </div>

          <div
            className="grid h-11 grid-cols-2 rounded-xl border border-white/10 bg-[#071525]/86 p-1 lg:w-[330px]"
            role="tablist"
            aria-label="Modo da Central de pedidos"
          >
            <button
              type="button"
              role="tab"
              aria-selected={operationalView === 'preparation'}
              onClick={() => handleOperationalViewChange('preparation')}
              className={cn(
                'inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300',
                operationalView === 'preparation'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Preparo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={operationalView === 'dispatch'}
              onClick={() => handleOperationalViewChange('dispatch')}
              className={cn(
                'inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                operationalView === 'dispatch'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
              )}
            >
              <Bike className="h-4 w-4" />
              Expedicao
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar pedido, cliente, endereco ou telefone..."
            className="min-w-0 flex-1"
            inputClassName="h-11 rounded-xl border-white/10 bg-[#071525]/90 pl-11 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:border-sky-400/45"
          />
          <div className="hidden h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-[#071525]/86 px-3 text-xs font-bold text-slate-200 sm:inline-flex">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                ordersQuery.isFetching ? 'bg-orange-300' : 'bg-emerald-400',
              )}
            />
            <Wifi className="h-4 w-4 text-slate-400" />
            {ordersQuery.isFetching ? 'Sincronizando' : 'Ao vivo'}
          </div>
          <Button
            type="button"
            variant="outline"
            aria-label="Atualizar pedidos"
            onClick={handleRefresh}
            disabled={ordersQuery.isFetching}
            className="h-11 w-11 shrink-0 rounded-xl border-white/10 bg-[#071525]/86 p-0 text-slate-100 hover:bg-white/[0.08]"
          >
            <RefreshCcw className={cn('h-4 w-4', ordersQuery.isFetching && 'animate-spin')} />
          </Button>

          <div ref={filterRef} className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              aria-expanded={filtersOpen}
              aria-label="Abrir filtros de pedidos"
              onClick={() => setFiltersOpen((current) => !current)}
              className="h-11 rounded-xl border-white/10 bg-[#071525]/86 px-3 text-slate-100 hover:bg-white/[0.08] sm:px-4"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              <ChevronDown className={cn('h-4 w-4 transition', filtersOpen && 'rotate-180')} />
            </Button>

            {filtersOpen ? (
              <div className="absolute right-0 top-12 z-30 w-[min(340px,calc(100vw-32px))] rounded-[22px] border border-white/10 bg-[#071525]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] ring-1 ring-white/[0.03] backdrop-blur-xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Tipo de pedido
                    </label>
                    <Select
                      value={selectedSource}
                      onValueChange={(value) => setSource(value as SourceFilter)}
                    >
                      <SelectTrigger className="h-11 border-white/10 bg-[#091827] text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent data-orders-filter-select="true">
                        {sourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Status
                    </label>
                    <Select
                      value={selectedStatus}
                      onValueChange={(value) => {
                        const status = value as KanbanStatusFilter
                        setStatus(status)
                        setDelayedOnly(false)
                        if (status !== 'all') {
                          setActiveMobileStatus(status)
                        }
                      }}
                    >
                      <SelectTrigger className="h-11 border-white/10 bg-[#091827] text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent data-orders-filter-select="true">
                        {availableStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Ordenacao
                    </label>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                      <SelectTrigger className="h-11 border-white/10 bg-[#091827] text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent data-orders-filter-select="true">
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearFilters}
                    className="h-10 w-full rounded-xl text-slate-300 hover:bg-white/[0.06]"
                  >
                    Limpar filtros
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="hidden gap-2 xl:flex" aria-label="Resumo da operacao">
        {activeColumns.map((column) => (
          <SummaryChip
            key={column.status}
            label={column.title}
            value={counts[column.status]}
            tone={column.tone}
            icon={summaryIconByStatus[column.status]}
            active={!delayedOnly && selectedStatus === column.status}
            onClick={() => handleStatusSummaryClick(column.status)}
          />
        ))}
        <SummaryChip
          label="Atrasados"
          value={counts.delayed}
          tone="red"
          icon={<AlertTriangle className="h-4 w-4" />}
          active={delayedOnly}
          onClick={() => {
            setDelayedOnly(!delayedOnly)
            setStatus('all')
          }}
        />
      </section>

      {ordersQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[24px] border border-white/10 bg-[#061525]/76 p-4">
              <Skeleton className="mb-4 h-8 w-44 bg-white/10" />
              <div className="space-y-3">
                <Skeleton className="h-32 rounded-[18px] bg-white/10" />
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
            onClick={handleRefresh}
            className="mt-5 rounded-xl bg-red-600 text-white hover:bg-red-500"
          >
            Tentar novamente
          </Button>
        </div>
      ) : boardOrders.length ? (
        <section className="pb-2">
          <div className="xl:hidden">
            <div
              className="mb-3 grid grid-cols-3 gap-2"
              role="tablist"
              aria-label="Etapas da operacao"
            >
              {activeColumns.map((column) => (
                <button
                  key={column.status}
                  type="button"
                  role="tab"
                  aria-selected={activeMobileStatus === column.status}
                  onClick={() => {
                    setActiveMobileStatus(column.status)
                    if (selectedStatus !== 'all') {
                      setStatus(column.status)
                    }
                  }}
                  className={cn(
                    'inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:text-sm',
                    activeMobileStatus === column.status
                      ? 'border-orange-400/35 bg-orange-500/15 text-white'
                      : 'border-white/10 bg-[#071525]/72 text-slate-400 hover:bg-white/[0.05] hover:text-white',
                  )}
                >
                  <span className="truncate">{column.mobileTitle}</span>
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-xs">
                    {counts[column.status]}
                  </span>
                </button>
              ))}
            </div>

            {activeColumns
              .filter((column) => column.status === activeMobileStatus)
              .map((column) => {
                const orders = boardOrders.filter((order) => order.status === column.status)

                return (
                  <KanbanOrderColumn
                    key={column.status}
                    column={column}
                    orders={orders}
                    selectedOrderId={selectedOrderId}
                    expanded={expandedColumns[column.status]}
                    canUpdate={canUpdateOrders && !updateOrderStatus.isPending}
                    canTrack={canTrackDeliveries}
                    onToggleExpanded={() =>
                      setExpandedColumns((current) => ({
                        ...current,
                        [column.status]: !current[column.status],
                      }))
                    }
                    onOpen={setSelectedOrderId}
                    onAction={handleAction}
                    onTrack={handleTrackDelivery}
                  />
                )
              })}
          </div>

          <div className="hidden gap-4 xl:grid xl:grid-cols-3">
            {activeColumns.map((column) => {
              const orders = boardOrders.filter((order) => order.status === column.status)

              return (
                <KanbanOrderColumn
                  key={column.status}
                  column={column}
                  orders={orders}
                  selectedOrderId={selectedOrderId}
                  expanded={expandedColumns[column.status]}
                  canUpdate={canUpdateOrders && !updateOrderStatus.isPending}
                  canTrack={canTrackDeliveries}
                  onToggleExpanded={() =>
                    setExpandedColumns((current) => ({
                      ...current,
                      [column.status]: !current[column.status],
                    }))
                  }
                  onOpen={setSelectedOrderId}
                  onAction={handleAction}
                  onTrack={handleTrackDelivery}
                />
              )
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-[#071a2d]/80 p-8">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="Nenhum pedido encontrado"
            description="Ajuste busca ou filtros para encontrar pedidos neste fluxo operacional."
          />
        </div>
      )}

      <OrderDrawer
        order={selectedOrder}
        open={Boolean(selectedOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderId(null)
          }
        }}
        onAction={handleAction}
        onTrackDelivery={handleTrackDelivery}
        canUpdate={canUpdateOrders}
        busy={updateOrderStatus.isPending}
      />

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
        title="Recusar ou cancelar pedido"
        description="Essa acao registra a alteracao no historico e remove o pedido do fluxo operacional ativo."
        confirmLabel="Confirmar"
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

function SummaryChip({
  label,
  value,
  tone,
  icon,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: KanbanColumnConfig['tone'] | 'red'
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  const toneClass = {
    cyan: 'border-sky-400/15 bg-sky-500/[0.08] text-sky-300',
    orange: 'border-orange-400/15 bg-orange-500/[0.08] text-orange-300',
    green: 'border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-300',
    blue: 'border-blue-400/15 bg-blue-500/[0.08] text-blue-300',
    neutral: 'border-slate-400/15 bg-slate-500/[0.08] text-slate-300',
    red: 'border-red-400/15 bg-red-500/[0.08] text-red-300',
  }[tone]
  const valueClass = {
    cyan: 'text-sky-300',
    orange: 'text-orange-300',
    green: 'text-emerald-300',
    blue: 'text-blue-300',
    neutral: 'text-slate-300',
    red: 'text-red-300',
  }[tone]

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-w-[148px] flex-1 rounded-xl border border-white/10 bg-[#071525]/82 px-3 py-2 text-left shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300',
        active && 'border-orange-400/40 bg-orange-500/[0.10] ring-1 ring-orange-400/25',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', toneClass)}>
            {icon}
          </span>
          <p className="whitespace-nowrap text-xs font-black text-slate-100">{label}</p>
        </div>
        <p className={cn('font-mono text-xl font-black tabular-nums', valueClass)}>
          {value}
        </p>
      </div>
    </button>
  )
}

function KanbanOrderColumn({
  column,
  orders,
  selectedOrderId,
  expanded,
  canUpdate,
  canTrack,
  onToggleExpanded,
  onOpen,
  onAction,
  onTrack,
}: {
  column: KanbanColumnConfig
  orders: Order[]
  selectedOrderId: string | null
  expanded: boolean
  canUpdate: boolean
  canTrack: boolean
  onToggleExpanded: () => void
  onOpen: (orderId: string) => void
  onAction: (orderId: string, action: OrderAction) => void
  onTrack: (order: Order) => void
}) {
  const toneClasses = buildColumnToneClasses(column.tone)
  const visibleOrders = getVisibleOperationalItems(orders, expanded, visiblePerColumn)

  return (
    <section
      className={cn(
        'flex min-h-[520px] min-w-0 flex-col rounded-[24px] border bg-[#061525]/78 p-3.5 shadow-[0_20px_70px_rgba(0,0,0,0.20)] ring-1 backdrop-blur-xl',
        toneClasses.border,
        toneClasses.ring,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', column.dotClass)} />
            <h2 className="truncate text-sm font-black text-white">{column.title}</h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs font-black text-slate-200">
              {orders.length}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">{column.description}</p>
        </div>
        <CircleDot className={cn('h-4 w-4 shrink-0', toneClasses.text)} />
      </header>

      <div className="flex-1 space-y-3">
        {visibleOrders.map((order) => (
          <KanbanOrderCard
            key={order.id}
            order={order}
            column={column}
            selected={order.id === selectedOrderId}
            canUpdate={canUpdate}
            canTrack={canTrack}
            onOpen={onOpen}
            onAction={onAction}
            onTrack={onTrack}
          />
        ))}

        {!orders.length ? (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum pedido nesta etapa.</p>
          </div>
        ) : null}
      </div>

      {orders.length > visiblePerColumn ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-black text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
        >
          {expanded ? 'Mostrar menos' : 'Ver mais pedidos'}
          <ChevronDown className={cn('h-4 w-4 transition', expanded && 'rotate-180')} />
        </button>
      ) : null}
    </section>
  )
}

function KanbanOrderCard({
  order,
  column,
  selected,
  canUpdate,
  canTrack,
  onOpen,
  onAction,
  onTrack,
}: {
  order: Order
  column: KanbanColumnConfig
  selected: boolean
  canUpdate: boolean
  canTrack: boolean
  onOpen: (orderId: string) => void
  onAction: (orderId: string, action: OrderAction) => void
  onTrack: (order: Order) => void
}) {
  const toneClasses = buildColumnToneClasses(column.tone)
  const primaryAction = getPrimaryOrderAction(order)
  const itemCount = getOrderItemCountLabel(order)
  const address = buildOrderAddress(order)
  const canRunAction = Boolean(primaryAction.action) && canUpdate
  const timing = getOrderTiming(order)
  const note = order.notes ?? order.items.find((item) => item.notes)?.notes
  const showTrackAction = order.status === 'out_for_delivery' && canTrack
  const showPrimaryAction = Boolean(primaryAction.action) || showTrackAction
  const timingClass = {
    normal: 'bg-slate-500/10 text-slate-300 ring-white/10',
    warning: 'bg-amber-500/12 text-amber-300 ring-amber-400/20',
    late: 'bg-red-500/15 text-red-300 ring-red-400/25',
    closed: 'bg-slate-500/10 text-slate-400 ring-white/10',
    unknown: 'bg-amber-500/10 text-amber-200 ring-amber-400/15',
  }[timing.state]

  return (
    <article
      className={cn(
        'group rounded-[18px] border border-white/10 bg-[#091827]/86 p-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#0b1f34]',
        selected && toneClasses.selected,
      )}
    >
      <button type="button" className="block w-full text-left" onClick={() => onOpen(order.id)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className={cn('font-mono text-base font-black', toneClasses.text)}>{order.number}</p>
            {order.priority !== 'normal' ? (
              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-300 ring-1 ring-red-400/20">
                {order.priority === 'vip' ? 'VIP' : 'Prioritario'}
              </span>
            ) : null}
          </div>
          <span className={cn('shrink-0 rounded-lg px-2 py-1 font-mono text-[11px] font-black ring-1', timingClass)}>
            {timing.label}
          </span>
        </div>

        <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-black text-white">{order.customerName}</h3>
            <span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-0.5 text-[10px] font-black text-slate-300 ring-1 ring-white/10">
              {channelLabelMap[order.source]}
            </span>
          </div>
          <span className="shrink-0 font-mono text-sm font-black text-slate-100">
            {formatCurrency(order.total)}
          </span>
        </div>

        <p className="mt-2.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span className="truncate">{address}</span>
        </p>

        <div className="mt-2.5 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <span className="inline-flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-slate-500" />
            {itemCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-slate-500" />
            {paymentLabelMap[order.paymentMethod]} ·{' '}
            <strong className={order.paymentStatus === 'pending' ? 'text-amber-300' : 'text-slate-300'}>
              {paymentStatusLabel[order.paymentStatus]}
            </strong>
          </span>
        </div>

        {order.status === 'ready' || order.status === 'out_for_delivery' ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Route className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            Motoboy:{' '}
            <span className={cn('truncate font-bold', order.driver ? 'text-slate-200' : 'text-amber-300')}>
              {order.driver?.name ?? 'Nao atribuido'}
            </span>
          </p>
        ) : null}

        {note ? (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-500/[0.08] px-2.5 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/15">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="line-clamp-2">{note}</span>
          </p>
        ) : null}
      </button>

      <div className={cn('mt-3 grid gap-2', showPrimaryAction && 'grid-cols-2')}>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpen(order.id)}
          className="h-11 rounded-xl border border-white/10 text-xs font-black text-slate-300 hover:bg-white/[0.06] hover:text-white"
        >
          Detalhes
        </Button>
        {showPrimaryAction ? (
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(primaryAction.action) && !canRunAction}
            onClick={(event) => {
              event.stopPropagation()
              if (primaryAction.action) {
                onAction(order.id, primaryAction.action)
                return
              }

              onTrack(order)
            }}
            className={cn('h-11 rounded-xl px-3 text-xs font-black shadow-none', toneClasses.button)}
          >
            {primaryAction.label}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
