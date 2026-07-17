import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSessionDrawer } from '@/features/dining/components/TableSessionDrawer'
import {
  useAddTableSessionItemsMutation,
  useCatalogMenuSourceQuery,
  useCloseTableSessionMutation,
  useDiningTablesQuery,
  useOpenTableSessionMutation,
  useSplitTableSessionMutation,
  useTransferTableSessionMutation,
  useUpdateTableSessionMutation,
  useWaitersQuery,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, DiningTable, Product, TableSession, TableStatus } from '@/types'
import {
  Armchair,
  ArrowRight,
  Clock3,
  CreditCard,
  LayoutGrid,
  Search,
  Shuffle,
  UserRound,
  Users,
} from 'lucide-react'

type StatusFilter = 'all' | 'free' | 'occupied' | 'reserved'

const statusLabels: Record<TableStatus, string> = {
  free: 'Livre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  closing: 'Fechando',
  closed: 'Fechada',
}

const statusStyles: Record<TableStatus, string> = {
  free: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  occupied: 'border-orange-300/30 bg-orange-400/10 text-orange-100',
  reserved: 'border-violet-300/30 bg-violet-400/10 text-violet-100',
  closing: 'border-red-300/30 bg-red-400/10 text-red-100',
  closed: 'border-white/10 bg-white/[0.04] text-muted-foreground',
}

function getSessionForTable(table: DiningTable, sessions: TableSession[]) {
  return sessions.find((session) => session.id === table.currentSessionId) ?? null
}

function formatElapsed(openedAt?: string) {
  if (!openedAt) {
    return 'Sem sessao'
  }

  const minutes = Math.max(0, Math.round((Date.now() - new Date(openedAt).getTime()) / 60000))
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}h ${rest}min`
}

function tableMatchesSearch(table: DiningTable, session: TableSession | null, search: string) {
  const normalized = search.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    table.code.toLowerCase().includes(normalized) ||
    (table.waiterName ?? '').toLowerCase().includes(normalized) ||
    (session?.waiterName ?? '').toLowerCase().includes(normalized) ||
    (table.notes ?? '').toLowerCase().includes(normalized) ||
    (session?.notes ?? '').toLowerCase().includes(normalized) ||
    (session?.items.some((item) => item.name.toLowerCase().includes(normalized)) ?? false)
  )
}

export function DiningTablesPage() {
  usePageTitle('Salao / Mesas')
  const diningQuery = useDiningTablesQuery()
  const waitersQuery = useWaitersQuery()
  const menuSourceQuery = useCatalogMenuSourceQuery({
    channel: 'dine_in',
    includeUnavailable: true,
  })
  const openSessionMutation = useOpenTableSessionMutation()
  const addSessionItemsMutation = useAddTableSessionItemsMutation()
  const updateSessionMutation = useUpdateTableSessionMutation()
  const closeSessionMutation = useCloseTableSessionMutation()
  const transferSessionMutation = useTransferTableSessionMutation()
  const splitSessionMutation = useSplitTableSessionMutation()
  const [selectedAreaId, setSelectedAreaId] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [drawerTableId, setDrawerTableId] = useState<string | null>(null)
  const canManageDining = useCan('dining:update')

  const areas = diningQuery.data?.data.areas ?? []
  const tables = useMemo(() => diningQuery.data?.data.tables ?? [], [diningQuery.data?.data.tables])
  const sessions = useMemo(
    () => diningQuery.data?.data.sessions ?? [],
    [diningQuery.data?.data.sessions],
  )
  const waiters = waitersQuery.data?.data ?? []
  const products = useMemo(
    () =>
      (menuSourceQuery.data?.data.categories ?? []).flatMap((category) =>
        category.products.map((product): Product => ({
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          price: product.basePrice,
          image: product.image,
          featured: product.featured,
          active: product.active,
          preparationStation: product.preparationStation,
          sortOrder: product.sortOrder,
          tags: product.tags,
          availability: product.channelAvailability ? [product.channelAvailability] : [],
          optionGroups: product.optionGroups,
        })),
      ),
    [menuSourceQuery.data?.data.categories],
  )
  const categories = useMemo<Category[]>(
    () =>
      (menuSourceQuery.data?.data.categories ?? [])
        .filter((category) => category.visibleForChannel)
        .map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          active: category.active,
          icon: category.icon,
          color: category.color,
          visibleOnPos: category.visibleOnPos,
          visibleOnDigitalMenu: category.visibleOnDigitalMenu,
          sortOrder: category.sortOrder,
          productCount: category.products.length,
        })),
    [menuSourceQuery.data?.data.categories],
  )
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? tables[0] ?? null
  const selectedSession = selectedTable ? getSessionForTable(selectedTable, sessions) : null
  const drawerTable = tables.find((table) => table.id === drawerTableId) ?? null
  const drawerSession = drawerTable ? getSessionForTable(drawerTable, sessions) : null

  const filteredTables = useMemo(
    () =>
      tables.filter((table) => {
        const session = getSessionForTable(table, sessions)
        const matchesArea = selectedAreaId === 'all' || table.areaId === selectedAreaId
        const matchesStatus = statusFilter === 'all' || table.status === statusFilter
        return matchesArea && matchesStatus && tableMatchesSearch(table, session, search)
      }),
    [search, selectedAreaId, sessions, statusFilter, tables],
  )

  const stats = {
    free: tables.filter((table) => table.status === 'free').length,
    occupied: tables.filter((table) => table.status === 'occupied').length,
    reserved: tables.filter((table) => table.status === 'reserved').length,
    openTotal: sessions
      .filter((session) => session.status !== 'closed')
      .reduce((total, session) => total + session.total, 0),
  }

  const busy =
    openSessionMutation.isPending ||
    addSessionItemsMutation.isPending ||
    updateSessionMutation.isPending ||
    closeSessionMutation.isPending ||
    transferSessionMutation.isPending ||
    splitSessionMutation.isPending

  function openManagement(tableId: string) {
    setSelectedTableId(tableId)
    setDrawerTableId(tableId)
  }

  return (
    <PageShell>
      <SectionHeader
        title="Salao / Mesas"
        description="Veja mesas, comandas abertas e ações disponíveis no salão."
      />

      <section className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar mesa, cliente, garcom ou item"
              className="pl-9"
            />
          </label>
          <Select value={selectedAreaId} onValueChange={(value) => setSelectedAreaId(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as areas</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'free', label: 'Livres' },
              { value: 'occupied', label: 'Ocupadas' },
              { value: 'reserved', label: 'Reservadas' },
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? 'default' : 'secondary'}
                onClick={() => setStatusFilter(filter.value as StatusFilter)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Livres" value={String(stats.free)} tone="free" />
        <SummaryCard label="Ocupadas" value={String(stats.occupied)} tone="occupied" />
        <SummaryCard label="Reservadas" value={String(stats.reserved)} tone="reserved" />
        <SummaryCard label="Total em aberto" value={formatCurrency(stats.openTotal)} tone="money" />
      </div>

      <div className="grid min-h-[640px] gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#071525]/86 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
          {diningQuery.isLoading ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="h-[180px] rounded-2xl" />
              ))}
            </div>
          ) : diningQuery.isError ? (
            <div className="p-6">
              <EmptyState
                icon={<LayoutGrid className="h-5 w-5" />}
                title="Falha ao carregar o salao"
                description="Mesas e comandas ainda não estão disponíveis. Tente atualizar."
              />
            </div>
          ) : filteredTables.length ? (
            <div className="grid max-h-[680px] gap-4 overflow-y-auto p-4 md:grid-cols-2 2xl:grid-cols-3 scrollbar-thin">
              {filteredTables.map((table) => {
                const session = getSessionForTable(table, sessions)
                return (
                  <DiningTableCard
                    key={table.id}
                    table={table}
                    session={session}
                    selected={selectedTable?.id === table.id}
                    onSelect={() => setSelectedTableId(table.id)}
                    onPrimary={() => openManagement(table.id)}
                  />
                )
              })}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={<LayoutGrid className="h-5 w-5" />}
                title="Nenhuma mesa encontrada"
                description="Ajuste busca, area ou filtro de status."
              />
            </div>
          )}
        </section>

        <TableDetailsPanel
          table={selectedTable}
          session={selectedSession}
          canManage={canManageDining}
          busy={busy}
          onOpenManagement={() => selectedTable && openManagement(selectedTable.id)}
        />
      </div>

      <TableSessionDrawer
        key={`${drawerTable?.id ?? 'closed'}:${drawerSession?.id ?? 'empty'}`}
        table={drawerTable}
        session={drawerSession}
        tables={tables}
        waiters={waiters}
        products={products}
        categories={categories}
        open={Boolean(drawerTableId)}
        busy={busy}
        canManage={canManageDining}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerTableId(null)
          }
        }}
        onOpenSession={(payload) => openSessionMutation.mutate(payload)}
        onAddItems={(payload) => addSessionItemsMutation.mutate(payload)}
        onUpdateSession={(payload) => updateSessionMutation.mutate(payload)}
        onCloseSession={(payload) => closeSessionMutation.mutate(payload)}
        onTransferSession={(payload) => transferSessionMutation.mutate(payload)}
        onSplitSession={(payload) => splitSessionMutation.mutate(payload)}
      />
    </PageShell>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'free' | 'occupied' | 'reserved' | 'money'
}) {
  const toneClass =
    tone === 'free'
      ? 'text-emerald-200'
      : tone === 'occupied'
        ? 'text-orange-200'
        : tone === 'reserved'
          ? 'text-violet-200'
          : 'text-cyan-200'

  return (
    <div className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-3xl font-semibold tracking-normal', toneClass)}>{value}</p>
    </div>
  )
}

interface DiningTableCardProps {
  table: DiningTable
  session: TableSession | null
  selected: boolean
  onSelect: () => void
  onPrimary: () => void
}

function DiningTableCard({ table, session, selected, onSelect, onPrimary }: DiningTableCardProps) {
  const isFree = table.status === 'free' || table.status === 'closed'
  const primaryLabel =
    table.status === 'reserved'
      ? 'Ver reserva'
      : isFree
        ? 'Iniciar pedido'
        : 'Continuar pedido'

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onSelect()
        }
      }}
      className={cn(
        'rounded-2xl border bg-[#050f1c] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/25',
        selected ? 'border-cyan-300/50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]' : 'border-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Mesa</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-100">{table.code}</h3>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', statusStyles[table.status])}>
          {statusLabels[table.status]}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {table.guests ?? session?.guestCount ?? 0}/{table.capacity} lugares
          </span>
          <span>{table.areaName ?? 'Salao'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            {session?.waiterName ?? table.waiterName ?? 'Sem garcom'}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-4 w-4" />
            {formatElapsed(session?.openedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
          <span>Total atual</span>
          <span className="font-mono font-semibold text-orange-200">
            {formatCurrency(session?.total ?? 0)}
          </span>
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        variant={isFree ? 'secondary' : 'default'}
        onClick={(event) => {
          event.stopPropagation()
          onPrimary()
        }}
      >
        {primaryLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </article>
  )
}

interface TableDetailsPanelProps {
  table: DiningTable | null
  session: TableSession | null
  canManage: boolean
  busy: boolean
  onOpenManagement: () => void
}

function TableDetailsPanel({
  table,
  session,
  canManage,
  busy,
  onOpenManagement,
}: TableDetailsPanelProps) {
  if (!table) {
    return (
      <aside className="rounded-2xl border border-white/10 bg-[#071525]/86 p-5">
        <EmptyState
          icon={<Armchair className="h-5 w-5" />}
          title="Selecione uma mesa"
          description="Os detalhes e a acao principal aparecem aqui."
        />
      </aside>
    )
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071525]/86 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Mesa selecionada</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Mesa {table.code}</h2>
          </div>
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', statusStyles[table.status])}>
            {statusLabels[table.status]}
          </span>
        </div>
        {table.status === 'reserved' && !session ? (
          <p className="mt-3 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-sm text-violet-100">
            Reserva marcada na mesa. O modulo de reservas detalhado ainda nao existe; use as observacoes da mesa quando houver.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailMetric label="Garcom" value={session?.waiterName ?? table.waiterName ?? 'Sem garcom'} />
          <DetailMetric label="Pessoas" value={String(session?.guestCount ?? table.guests ?? 0)} />
          <DetailMetric label="Aberta ha" value={formatElapsed(session?.openedAt)} />
          <DetailMetric label="Total atual" value={formatCurrency(session?.total ?? 0)} highlight />
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-100">Itens da comanda</h3>
            <Badge variant={session?.items.length ? 'success' : 'default'}>
              {session?.items.length ?? 0} item(ns)
            </Badge>
          </div>
          {session?.items.length ? (
            <div className="space-y-2">
              {session.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#050f1c] px-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">
                      {item.quantity}x {item.name}
                    </p>
                    {item.notes ? (
                      <p className="truncate text-xs text-muted-foreground">{item.notes}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.createdByName ?? session.waiterName ?? 'Equipe'} lançou
                      {item.createdAt ? ` as ${formatItemTime(item.createdAt)}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-orange-200">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4 text-sm text-muted-foreground">
              Nenhum item lancado nesta comanda.
            </p>
          )}
        </div>

        <div className="mt-5">
          <h3 className="font-semibold text-slate-100">Observacao</h3>
          <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-muted-foreground">
            {session?.notes || table.notes || 'Sem observacao.'}
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={!canManage || busy || !session} onClick={onOpenManagement}>
            <Shuffle className="h-4 w-4" />
            Trocar mesa
          </Button>
          <Button variant="secondary" disabled={!canManage || busy || !session} onClick={onOpenManagement}>
            <CreditCard className="h-4 w-4" />
            Fechar comanda
          </Button>
        </div>
        <Button className="mt-2 w-full" disabled={!canManage || busy} onClick={onOpenManagement}>
          {session ? 'Abrir / Continuar pedido' : 'Iniciar pedido nesta mesa'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}

function formatItemTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function DetailMetric({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-semibold text-slate-100', highlight && 'font-mono text-orange-200')}>
        {value}
      </p>
    </div>
  )
}
