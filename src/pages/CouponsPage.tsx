import { type ReactNode, useMemo, useState } from 'react'

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  useCouponsQuery,
  useSaveCouponMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Coupon, ProductChannel } from '@/types'
import {
  Armchair,
  Bike,
  Copy,
  DollarSign,
  Globe2,
  Pencil,
  Percent,
  Plus,
  Search,
  Store,
  TicketPercent,
} from 'lucide-react'

type CouponType = Coupon['type']
type StatusFilter = Coupon['status'] | 'all'
type ChannelFilter = ProductChannel | 'all'

const productChannels: ProductChannel[] = ['delivery', 'digital_menu', 'counter', 'dine_in']

const channelOptions: Array<{
  channel: ProductChannel
  label: string
  description: string
  Icon: typeof Bike
}> = [
  {
    channel: 'delivery',
    label: 'Delivery',
    description: 'Pedidos para entrega.',
    Icon: Bike,
  },
  {
    channel: 'digital_menu',
    label: 'Cardapio digital',
    description: 'Pedidos feitos pelo cliente online.',
    Icon: Globe2,
  },
  {
    channel: 'counter',
    label: 'Balcao',
    description: 'Pedidos presenciais no balcao.',
    Icon: Store,
  },
  {
    channel: 'dine_in',
    label: 'Salao / Mesas',
    description: 'Comandas e pedidos de mesa.',
    Icon: Armchair,
  },
]

const channelLabels = Object.fromEntries(
  channelOptions.map((option) => [option.channel, option.label]),
) as Record<ProductChannel, string>

function createEmptyCoupon(): Coupon {
  return {
    id: '',
    code: '',
    description: '',
    type: 'percent',
    value: 10,
    minOrderAmount: 0,
    channels: ['delivery'],
    uses: 0,
    status: 'inactive',
  }
}

function sanitizeCouponCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, '')
}

function formatCouponValue(coupon: Pick<Coupon, 'type' | 'value'>) {
  return coupon.type === 'percent' ? `${coupon.value}%` : formatCurrency(coupon.value)
}

function formatDate(value?: string) {
  if (!value) {
    return 'Sem validade'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(value))
}

function getCouponDisplayStatus(coupon: Coupon) {
  if (coupon.status === 'inactive') {
    return { label: 'Inativo', value: 'inactive' as const, variant: 'default' as const }
  }

  const now = Date.now()
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
    return { label: 'Agendado', value: 'scheduled' as const, variant: 'warning' as const }
  }
  if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now) {
    return { label: 'Expirado', value: 'expired' as const, variant: 'danger' as const }
  }

  return { label: 'Ativo', value: 'active' as const, variant: 'success' as const }
}

function couponMatchesSearch(coupon: Coupon, search: string) {
  const normalized = search.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    coupon.code.toLowerCase().includes(normalized) ||
    (coupon.description ?? '').toLowerCase().includes(normalized)
  )
}

function calculatePreviewDiscount(coupon: Pick<Coupon, 'type' | 'value'>) {
  const sampleOrder = 100
  return coupon.type === 'percent'
    ? Math.min(sampleOrder, (sampleOrder * coupon.value) / 100)
    : Math.min(sampleOrder, coupon.value)
}

export function CouponsPage() {
  usePageTitle('Cupons')
  const canManageCoupons = useCan('catalog:coupons:manage')
  const couponsQuery = useCouponsQuery()
  const saveCouponMutation = useSaveCouponMutation()
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [typeFilter, setTypeFilter] = useState<CouponType | 'all'>('all')
  const coupons = useMemo(() => couponsQuery.data?.data ?? [], [couponsQuery.data?.data])

  const visibleCoupons = useMemo(
    () =>
      coupons.filter((coupon) => {
        const displayStatus = getCouponDisplayStatus(coupon)
        const matchesStatus =
          statusFilter === 'all' ||
          coupon.status === statusFilter ||
          displayStatus.value === statusFilter
        const matchesChannel =
          channelFilter === 'all' || coupon.channels.includes(channelFilter)
        const matchesType = typeFilter === 'all' || coupon.type === typeFilter

        return (
          couponMatchesSearch(coupon, search) &&
          matchesStatus &&
          matchesChannel &&
          matchesType
        )
      }),
    [channelFilter, coupons, search, statusFilter, typeFilter],
  )

  function saveCoupon(coupon: Coupon) {
    saveCouponMutation.mutate(
      {
        ...coupon,
        code: sanitizeCouponCode(coupon.code),
      },
      {
        onSuccess: () => setEditingCoupon(null),
      },
    )
  }

  return (
    <PageShell>
      <SectionHeader
        title="Cupons"
        description="Cupons reais, com canais visuais e validacao respeitando onde cada desconto vale."
        actions={
          canManageCoupons ? (
            <Button onClick={() => setEditingCoupon(createEmptyCoupon())}>
              <Plus className="h-4 w-4" />
              Novo cupom
            </Button>
          ) : null
        }
      />

      <section className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_160px_180px_150px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por codigo ou nome"
              className="pl-9"
            />
          </label>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="scheduled">Agendados</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={channelFilter}
            onValueChange={(value) => setChannelFilter(value as ChannelFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {channelOptions.map((option) => (
                <SelectItem key={option.channel} value={option.channel}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as CouponType | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="percent">Percentual</SelectItem>
              <SelectItem value="fixed">Valor fixo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#071525]/86 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid grid-cols-[minmax(220px,1.2fr)_120px_150px_140px_190px_170px] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span>Cupom</span>
          <span>Desconto</span>
          <span>Pedido minimo</span>
          <span>Status</span>
          <span>Canais</span>
          <span className="text-right">Acoes</span>
        </div>

        {couponsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : visibleCoupons.length ? (
          <div className="divide-y divide-white/10">
            {visibleCoupons.map((coupon) => {
              const status = getCouponDisplayStatus(coupon)

              return (
                <article
                  key={coupon.id}
                  className="grid grid-cols-[minmax(220px,1.2fr)_120px_150px_140px_190px_170px] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.035]"
                >
                  <div className="min-w-0">
                    <h3 className="font-mono text-base font-semibold text-slate-100">{coupon.code}</h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {coupon.description || 'Sem descricao'} - ate {formatDate(coupon.validUntil)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uso: {coupon.uses}
                      {coupon.maxUses ? `/${coupon.maxUses}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-orange-300">
                    {formatCouponValue(coupon)}
                  </span>
                  <span className="text-sm text-slate-300">{formatCurrency(coupon.minOrderAmount)}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <div className="flex flex-wrap gap-1.5">
                    {coupon.channels.map((channel) => (
                      <span
                        key={channel}
                        className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100"
                      >
                        {channelLabels[channel]}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canManageCoupons || saveCouponMutation.isPending}
                      onClick={() =>
                        saveCouponMutation.mutate({
                          ...coupon,
                          status: coupon.status === 'active' ? 'inactive' : 'active',
                        })
                      }
                    >
                      {coupon.status === 'active' ? 'Inativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Duplicar cupom"
                      disabled={!canManageCoupons}
                      onClick={() =>
                        setEditingCoupon({
                          ...coupon,
                          id: '',
                          code: `${coupon.code}_COPIA`,
                          status: 'inactive',
                          uses: 0,
                        })
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Editar cupom"
                      disabled={!canManageCoupons}
                      onClick={() => setEditingCoupon(coupon)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={<TicketPercent className="h-5 w-5" />}
              title="Nenhum cupom encontrado"
              description="Crie um cupom real ou ajuste os filtros compactos."
            />
          </div>
        )}
      </section>

      <Sheet open={Boolean(editingCoupon)} onOpenChange={(open) => !open && setEditingCoupon(null)}>
        <SheetContent className="max-w-[980px]">
          <SheetHeader>
            <SheetTitle>{editingCoupon?.id ? 'Editar cupom' : 'Novo cupom'}</SheetTitle>
            <SheetDescription>
              Configure o cupom em blocos simples. Os canais salvos aqui serao usados ao validar o desconto.
            </SheetDescription>
          </SheetHeader>

          {editingCoupon ? (
            <CouponForm
              coupon={editingCoupon}
              busy={saveCouponMutation.isPending}
              onCancel={() => setEditingCoupon(null)}
              onSave={saveCoupon}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </PageShell>
  )
}

interface CouponFormProps {
  coupon: Coupon
  busy: boolean
  onCancel: () => void
  onSave: (coupon: Coupon) => void
}

function CouponForm({ coupon, busy, onCancel, onSave }: CouponFormProps) {
  const [draft, setDraft] = useState<Coupon>({
    ...coupon,
    code: sanitizeCouponCode(coupon.code),
  })
  const selectedStatus = getCouponDisplayStatus(draft)
  const active = draft.status === 'active'
  const previewDiscount = calculatePreviewDiscount(draft)
  const canSave = draft.code.trim().length >= 2 && draft.channels.length > 0 && draft.value > 0

  function toggleChannel(channel: ProductChannel) {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((entry) => entry !== channel)
        : [...current.channels, channel],
    }))
  }

  return (
    <form
      className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) {
          onSave(draft)
        }
      }}
    >
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-100">Informacoes do cupom</h3>
              <p className="text-sm text-muted-foreground">
                Esse e o codigo que o cliente vai informar no pedido.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#071525] px-3 py-2">
              <span className="text-sm text-slate-200">Cupom ativo</span>
              <Switch
                checked={active}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    status: checked ? 'active' : 'inactive',
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_190px]">
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Nome interno
              <Input
                value={draft.description ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Ex.: Semana do delivery"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Codigo do cupom
              <Input
                value={draft.code}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    code: sanitizeCouponCode(event.target.value),
                  }))
                }
                placeholder="CAIN10"
                required
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h3 className="font-semibold text-slate-100">Tipo de desconto</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DiscountTypeCard
              selected={draft.type === 'percent'}
              icon={<Percent className="h-4 w-4" />}
              title="Percentual"
              description="Ex.: 10% sobre o total."
              onClick={() => setDraft((current) => ({ ...current, type: 'percent' }))}
            />
            <DiscountTypeCard
              selected={draft.type === 'fixed'}
              icon={<DollarSign className="h-4 w-4" />}
              title="Valor fixo"
              description="Ex.: R$ 15,00 de desconto."
              onClick={() => setDraft((current) => ({ ...current, type: 'fixed' }))}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Valor do desconto
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.value}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, value: Number(event.target.value) }))
                }
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Pedido minimo
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.minOrderAmount}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, minOrderAmount: Number(event.target.value) }))
                }
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Uso maximo
              <Input
                type="number"
                min={1}
                value={draft.maxUses ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxUses: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            Em um pedido de {formatCurrency(100)}, esse cupom aplicaria{' '}
            <strong>{formatCurrency(previewDiscount)}</strong> de desconto.
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-100">Canais onde vale</h3>
              <p className="text-sm text-muted-foreground">
                Escolha onde o atendente ou cliente podera usar este cupom.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDraft((current) => ({ ...current, channels: productChannels }))}
              >
                Selecionar todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft((current) => ({ ...current, channels: [] }))}
              >
                Limpar selecao
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {channelOptions.map(({ channel, label, description, Icon }) => {
              const selected = draft.channels.includes(channel)

              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                    selected
                      ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                      : 'border-white/10 bg-[#071525]/80 text-slate-200 hover:border-white/20',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                      selected
                        ? 'border-cyan-300/30 bg-cyan-400/15 text-cyan-100'
                        : 'border-white/10 bg-white/[0.04] text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-3 font-semibold">
                      {label}
                      <span
                        className={cn(
                          'h-4 w-4 rounded border',
                          selected
                            ? 'border-cyan-200 bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                            : 'border-white/20 bg-transparent',
                        )}
                      />
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {!draft.channels.length ? (
            <p className="mt-3 text-sm text-red-300">Selecione pelo menos 1 canal para salvar.</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h3 className="font-semibold text-slate-100">Validade e limites</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Data inicial
              <Input
                type="datetime-local"
                value={draft.validFrom?.slice(0, 16) ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, validFrom: event.target.value || undefined }))
                }
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Data final
              <Input
                type="datetime-local"
                value={draft.validUntil?.slice(0, 16) ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, validUntil: event.target.value || undefined }))
                }
              />
            </label>
          </div>
        </section>
      </div>

      <aside className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-[#050f1c] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
          <TicketPercent className="h-4 w-4" />
          Resumo do cupom
        </div>
        <div className="mt-5 space-y-4 text-sm">
          <PreviewRow label="Codigo" value={draft.code || 'Sem codigo'} strong />
          <PreviewRow label="Desconto" value={formatCouponValue(draft)} />
          <PreviewRow label="Pedido minimo" value={formatCurrency(draft.minOrderAmount)} />
          <PreviewRow label="Validade" value={`${formatDate(draft.validFrom)} - ${formatDate(draft.validUntil)}`} />
          <PreviewRow label="Status" value={selectedStatus.label} />
          <div>
            <p className="text-muted-foreground">Canais</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.channels.length ? (
                draft.channels.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100"
                  >
                    {channelLabels[channel]}
                  </span>
                ))
              ) : (
                <span className="text-red-300">Nenhum canal selecionado</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
          <Button type="submit" disabled={busy || !canSave}>
            {busy ? 'Salvando...' : 'Salvar cupom'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </aside>
    </form>
  )
}

interface DiscountTypeCardProps {
  selected: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}

function DiscountTypeCard({ selected, icon, title, description, onClick }: DiscountTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition',
        selected
          ? 'border-orange-300/50 bg-orange-400/10 text-orange-50'
          : 'border-white/10 bg-[#071525] text-slate-200 hover:border-white/20',
      )}
    >
      <span className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
    </button>
  )
}

function PreviewRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right text-slate-100', strong && 'font-mono font-semibold')}>
        {value}
      </span>
    </div>
  )
}
