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
  useCategoriesQuery,
  useProductsQuery,
  usePromotionsQuery,
  useSavePromotionMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Product, ProductChannel, Promotion, PromotionRules } from '@/types'
import {
  Armchair,
  BadgePercent,
  Bike,
  Boxes,
  Copy,
  DollarSign,
  Globe2,
  Layers2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Store,
} from 'lucide-react'

type PromotionType = Promotion['type']
type StatusFilter = Promotion['status'] | 'all'
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
    description: 'Cardapio online do cliente.',
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

const promotionTypeLabels: Record<PromotionType, string> = {
  percent: 'Desconto percentual',
  fixed: 'Valor fixo',
  combo: 'Combo promocional',
}

function createDefaultRules(categories: Category[]): PromotionRules {
  const pizzaCategory = categories.find((category) =>
    category.name.toLowerCase().includes('pizza'),
  )

  return {
    requiredItems: 2,
    participantType: 'category',
    participantId: pizzaCategory?.id,
    sizeLabel: 'Grande',
    flavorLimitPerItem: 1,
    finalPrice: 100,
    notes: '2 pizzas grandes, 1 sabor em cada.',
  }
}

function createEmptyPromotion(categories: Category[]): Promotion {
  return {
    id: '',
    name: '',
    description: '',
    type: 'percent',
    discountValue: 10,
    channels: ['delivery'],
    productIds: [],
    categoryIds: [],
    status: 'inactive',
    rules: createDefaultRules(categories),
  }
}

function formatDate(value?: string) {
  if (!value) {
    return 'Sem periodo'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getPromotionDisplayStatus(promotion: Promotion) {
  if (promotion.status === 'inactive') {
    return { label: 'Inativa', value: 'inactive' as const, variant: 'default' as const }
  }

  const now = Date.now()
  if (promotion.startsAt && new Date(promotion.startsAt).getTime() > now) {
    return { label: 'Agendada', value: 'scheduled' as const, variant: 'warning' as const }
  }
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() < now) {
    return { label: 'Expirada', value: 'expired' as const, variant: 'danger' as const }
  }

  return { label: 'Ativa', value: 'active' as const, variant: 'success' as const }
}

function promotionMatchesSearch(promotion: Promotion, search: string) {
  const normalized = search.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    promotion.name.toLowerCase().includes(normalized) ||
    (promotion.description ?? '').toLowerCase().includes(normalized)
  )
}

function formatPromotionValue(promotion: Promotion) {
  if (promotion.type === 'combo' && promotion.rules?.finalPrice) {
    return formatCurrency(promotion.rules.finalPrice)
  }
  if (promotion.type === 'percent') {
    return `${promotion.discountValue ?? 0}%`
  }
  return formatCurrency(promotion.discountValue ?? 0)
}

function calculatePreview(promotion: Pick<Promotion, 'type' | 'discountValue' | 'rules'>) {
  if (promotion.type === 'combo') {
    return promotion.rules?.finalPrice ? formatCurrency(promotion.rules.finalPrice) : 'Preco final nao definido'
  }

  const sampleOrder = 100
  const discount =
    promotion.type === 'percent'
      ? (sampleOrder * (promotion.discountValue ?? 0)) / 100
      : promotion.discountValue ?? 0

  return `${formatCurrency(Math.min(sampleOrder, discount))} de desconto em ${formatCurrency(sampleOrder)}`
}

export function PromotionsPage() {
  usePageTitle('Promocoes')
  const canManagePromotions = useCan('catalog:promotions:manage')
  const promotionsQuery = usePromotionsQuery()
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery({ pageSize: 120 })
  const savePromotionMutation = useSavePromotionMutation()
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [typeFilter, setTypeFilter] = useState<PromotionType | 'all'>('all')
  const promotions = useMemo(() => promotionsQuery.data?.data ?? [], [promotionsQuery.data?.data])
  const categories = categoriesQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []

  const visiblePromotions = useMemo(
    () =>
      promotions.filter((promotion) => {
        const displayStatus = getPromotionDisplayStatus(promotion)
        const matchesStatus =
          statusFilter === 'all' ||
          promotion.status === statusFilter ||
          displayStatus.value === statusFilter
        const matchesChannel =
          channelFilter === 'all' || promotion.channels.includes(channelFilter)
        const matchesType = typeFilter === 'all' || promotion.type === typeFilter

        return (
          promotionMatchesSearch(promotion, search) &&
          matchesStatus &&
          matchesChannel &&
          matchesType
        )
      }),
    [channelFilter, promotions, search, statusFilter, typeFilter],
  )

  function savePromotion(promotion: Promotion) {
    const rules = promotion.type === 'combo' ? promotion.rules : undefined
    savePromotionMutation.mutate(
      {
        ...promotion,
        rules,
        discountValue:
          promotion.type === 'combo' ? promotion.rules?.finalPrice ?? promotion.discountValue : promotion.discountValue,
        categoryIds:
          rules?.participantType === 'category' && rules.participantId ? [rules.participantId] : [],
        productIds:
          rules?.participantType === 'product' && rules.participantId ? [rules.participantId] : [],
      },
      {
        onSuccess: () => setEditingPromotion(null),
      },
    )
  }

  return (
    <PageShell>
      <SectionHeader
        title="Promocoes"
        description="Promocoes reais com canais, validade e regra composta para combos de restaurante."
        actions={
          canManagePromotions ? (
            <Button onClick={() => setEditingPromotion(createEmptyPromotion(categories))}>
              <Plus className="h-4 w-4" />
              Nova promocao
            </Button>
          ) : null
        }
      />

      <section className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_160px_180px_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar promocao"
              className="pl-9"
            />
          </label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
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
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as PromotionType | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="percent">Percentual</SelectItem>
              <SelectItem value="fixed">Valor fixo</SelectItem>
              <SelectItem value="combo">Combo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#071525]/86 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid grid-cols-[minmax(260px,1.4fr)_160px_150px_210px_170px] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span>Promocao</span>
          <span>Tipo</span>
          <span>Status</span>
          <span>Canais</span>
          <span className="text-right">Acoes</span>
        </div>

        {promotionsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : visiblePromotions.length ? (
          <div className="divide-y divide-white/10">
            {visiblePromotions.map((promotion) => {
              const status = getPromotionDisplayStatus(promotion)
              return (
                <article
                  key={promotion.id}
                  className="grid grid-cols-[minmax(260px,1.4fr)_160px_150px_210px_170px] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.035]"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-100">{promotion.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {promotion.description || 'Sem descricao'} - {formatDate(promotion.startsAt)} ate{' '}
                      {formatDate(promotion.endsAt)}
                    </p>
                    {promotion.rules ? (
                      <p className="text-xs text-cyan-200">
                        {promotion.rules.requiredItems} item(ns), ate{' '}
                        {promotion.rules.flavorLimitPerItem ?? 1} sabor por item
                      </p>
                    ) : null}
                  </div>
                  <span className="text-sm text-slate-300">
                    {promotionTypeLabels[promotion.type]} - {formatPromotionValue(promotion)}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <div className="flex flex-wrap gap-1.5">
                    {promotion.channels.map((channel) => (
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
                      disabled={!canManagePromotions || savePromotionMutation.isPending}
                      onClick={() =>
                        savePromotionMutation.mutate({
                          ...promotion,
                          status: promotion.status === 'active' ? 'inactive' : 'active',
                        })
                      }
                    >
                      {promotion.status === 'active' ? 'Inativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Duplicar promocao"
                      disabled={!canManagePromotions}
                      onClick={() =>
                        setEditingPromotion({
                          ...promotion,
                          id: '',
                          name: `${promotion.name} copia`,
                          status: 'inactive',
                        })
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Editar promocao"
                      disabled={!canManagePromotions}
                      onClick={() => setEditingPromotion(promotion)}
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
              icon={<Megaphone className="h-5 w-5" />}
              title="Nenhuma promocao encontrada"
              description="Crie uma promocao real ou ajuste os filtros compactos."
            />
          </div>
        )}
      </section>

      <Sheet
        open={Boolean(editingPromotion)}
        onOpenChange={(open) => !open && setEditingPromotion(null)}
      >
        <SheetContent className="max-w-[1040px]">
          <SheetHeader>
            <SheetTitle>{editingPromotion?.id ? 'Editar promocao' : 'Nova promocao'}</SheetTitle>
            <SheetDescription>
              Configure desconto simples ou combo de restaurante com regra salva no banco.
            </SheetDescription>
          </SheetHeader>

          {editingPromotion ? (
            <PromotionForm
              promotion={editingPromotion}
              categories={categories}
              products={products}
              busy={savePromotionMutation.isPending}
              onCancel={() => setEditingPromotion(null)}
              onSave={savePromotion}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </PageShell>
  )
}

interface PromotionFormProps {
  promotion: Promotion
  categories: Category[]
  products: Product[]
  busy: boolean
  onCancel: () => void
  onSave: (promotion: Promotion) => void
}

function PromotionForm({
  promotion,
  categories,
  products,
  busy,
  onCancel,
  onSave,
}: PromotionFormProps) {
  const [draft, setDraft] = useState<Promotion>({
    ...promotion,
    rules: promotion.rules ?? createDefaultRules(categories),
  })
  const active = draft.status === 'active'
  const selectedStatus = getPromotionDisplayStatus(draft)
  const rules = draft.rules ?? createDefaultRules(categories)
  const canSave = draft.name.trim().length >= 2 && draft.channels.length > 0

  function setType(type: PromotionType) {
    setDraft((current) => ({
      ...current,
      type,
      rules: type === 'combo' ? current.rules ?? createDefaultRules(categories) : current.rules,
    }))
  }

  function setRules(nextRules: PromotionRules) {
    setDraft((current) => ({
      ...current,
      rules: nextRules,
      discountValue: nextRules.finalPrice ?? current.discountValue,
    }))
  }

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
      className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]"
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
              <h3 className="font-semibold text-slate-100">Informacoes basicas</h3>
              <p className="text-sm text-muted-foreground">
                Use nomes que qualquer atendente reconheca rapidamente.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#071525] px-3 py-2">
              <span className="text-sm text-slate-200">Promocao ativa</span>
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
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Nome
              <Input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex.: Combo da Pizza"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Descricao curta
              <Input
                value={draft.description ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Ex.: 2 pizzas grandes por preco fechado"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h3 className="font-semibold text-slate-100">Tipo de promocao</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <PromotionTypeCard
              selected={draft.type === 'percent'}
              icon={<BadgePercent className="h-4 w-4" />}
              title="Percentual"
              description="Ex.: 10% em burgers."
              onClick={() => setType('percent')}
            />
            <PromotionTypeCard
              selected={draft.type === 'fixed'}
              icon={<DollarSign className="h-4 w-4" />}
              title="Valor fixo"
              description="Ex.: R$ 15 em pedidos acima de R$ 80."
              onClick={() => setType('fixed')}
            />
            <PromotionTypeCard
              selected={draft.type === 'combo'}
              icon={<Boxes className="h-4 w-4" />}
              title="Combo"
              description="Ex.: 2 pizzas grandes, 1 sabor cada."
              onClick={() => setType('combo')}
            />
          </div>

          {draft.type !== 'combo' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Valor
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.discountValue ?? 0}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      discountValue: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                Preview: <strong>{calculatePreview(draft)}</strong>
              </div>
            </div>
          ) : null}
        </section>

        {draft.type === 'combo' ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2">
              <Layers2 className="h-4 w-4 text-cyan-200" />
              <h3 className="font-semibold text-slate-100">Regras do combo</h3>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Quantidade de itens
                <Input
                  type="number"
                  min={1}
                  value={rules.requiredItems}
                  onChange={(event) =>
                    setRules({ ...rules, requiredItems: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Tamanho
                <Input
                  value={rules.sizeLabel ?? ''}
                  onChange={(event) => setRules({ ...rules, sizeLabel: event.target.value })}
                  placeholder="Ex.: Grande, Gigante"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Sabores por item
                <Input
                  type="number"
                  min={0}
                  value={rules.flavorLimitPerItem ?? 1}
                  onChange={(event) =>
                    setRules({
                      ...rules,
                      flavorLimitPerItem: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Participante
                <Select
                  value={rules.participantType}
                  onValueChange={(value) =>
                    setRules({
                      ...rules,
                      participantType: value as PromotionRules['participantType'],
                      participantId: undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Categoria</SelectItem>
                    <SelectItem value="product">Produto</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Produto ou categoria
                <Select
                  value={rules.participantId ?? 'none'}
                  onValueChange={(value) =>
                    setRules({ ...rules, participantId: value === 'none' ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o participante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem participante especifico</SelectItem>
                    {rules.participantType === 'category'
                      ? categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      : products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Preco final
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rules.finalPrice ?? 0}
                  onChange={(event) => setRules({ ...rules, finalPrice: Number(event.target.value) })}
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Observacao da regra
                <Input
                  value={rules.notes ?? ''}
                  onChange={(event) => setRules({ ...rules, notes: event.target.value })}
                  placeholder="Ex.: 2 pizzas gigantes, 1 sabor cada pizza"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              Preview: {rules.requiredItems} item(ns)
              {rules.sizeLabel ? ` ${rules.sizeLabel}` : ''}, ate {rules.flavorLimitPerItem ?? 1}{' '}
              sabor(es) por item, por <strong>{formatCurrency(rules.finalPrice ?? 0)}</strong>.
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-100">Canais onde vale</h3>
              <p className="text-sm text-muted-foreground">Selecione onde a promocao aparece.</p>
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
                      ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-50'
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
                  <span>
                    <span className="font-semibold">{label}</span>
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
          <h3 className="font-semibold text-slate-100">Validade</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Inicio
              <Input
                type="datetime-local"
                value={draft.startsAt?.slice(0, 16) ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, startsAt: event.target.value || undefined }))
                }
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              Fim
              <Input
                type="datetime-local"
                value={draft.endsAt?.slice(0, 16) ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, endsAt: event.target.value || undefined }))
                }
              />
            </label>
          </div>
        </section>
      </div>

      <aside className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-[#050f1c] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
          <Megaphone className="h-4 w-4" />
          Resumo da promocao
        </div>
        <div className="mt-5 space-y-4 text-sm">
          <PreviewRow label="Nome" value={draft.name || 'Sem nome'} strong />
          <PreviewRow label="Tipo" value={promotionTypeLabels[draft.type]} />
          <PreviewRow label="Valor" value={formatPromotionValue(draft)} />
          <PreviewRow label="Status" value={selectedStatus.label} />
          <PreviewRow label="Periodo" value={`${formatDate(draft.startsAt)} - ${formatDate(draft.endsAt)}`} />
          {draft.type === 'combo' ? (
            <div className="rounded-2xl border border-orange-300/20 bg-orange-400/10 p-3 text-orange-50">
              <p className="font-semibold">Regra composta</p>
              <p className="mt-1 text-sm text-orange-100/80">
                {rules.requiredItems} item(ns), {rules.sizeLabel || 'sem tamanho'}, ate{' '}
                {rules.flavorLimitPerItem ?? 1} sabor(es) por item.
              </p>
            </div>
          ) : null}
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
            {busy ? 'Salvando...' : 'Salvar promocao'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </aside>
    </form>
  )
}

interface PromotionTypeCardProps {
  selected: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}

function PromotionTypeCard({ selected, icon, title, description, onClick }: PromotionTypeCardProps) {
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
      <span className={cn('text-right text-slate-100', strong && 'font-semibold')}>{value}</span>
    </div>
  )
}
