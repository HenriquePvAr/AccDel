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
import { ProductFormDrawer } from '@/features/catalog/components/ProductFormDrawer'
import {
  useCategoriesQuery,
  useProductsQuery,
  useSaveProductMutation,
  useToggleProductSoldOutMutation,
  useUpdateProductChannelMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import type { Product, ProductChannel } from '@/types'
import {
  Copy,
  ImageIcon,
  Layers2,
  PackageSearch,
  Pencil,
  Plus,
  Power,
  Search,
} from 'lucide-react'

type StatusFilter = 'all' | 'active' | 'inactive'
type AvailabilityFilter = 'all' | 'available' | 'sold_out'

const productChannels: ProductChannel[] = ['delivery', 'counter', 'dine_in', 'digital_menu']
const channelLabels: Record<ProductChannel, string> = {
  delivery: 'Delivery',
  counter: 'Balcao',
  dine_in: 'Salao',
  digital_menu: 'Digital',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function channelIsOperational(product: Product, channel: ProductChannel) {
  const availability = product.availability.find((entry) => entry.channel === channel)
  return Boolean(availability?.visible && availability.available && !availability.soldOut)
}

function productMatchesAvailability(
  product: Product,
  channel: ProductChannel | 'all',
  availabilityFilter: AvailabilityFilter,
) {
  if (availabilityFilter === 'all') {
    return true
  }

  const entries =
    channel === 'all'
      ? product.availability
      : product.availability.filter((entry) => entry.channel === channel)

  if (availabilityFilter === 'available') {
    return entries.some((entry) => entry.visible && entry.available && !entry.soldOut)
  }

  return entries.some((entry) => entry.soldOut)
}

export function ProductsPage() {
  usePageTitle('Produtos')
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ProductChannel | 'all'>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all')
  const [editingProductId, setEditingProductId] = useState<string | 'new' | null>(null)
  const canManageProducts = useCan('catalog:products:manage')
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery({
    search,
    categoryId: selectedCategoryId,
    status: statusFilter,
    channel: channelFilter,
    pageSize: 80,
  })
  const saveProductMutation = useSaveProductMutation()
  const toggleSoldOutMutation = useToggleProductSoldOutMutation()
  const updateProductChannelMutation = useUpdateProductChannelMutation()

  const categories = useMemo(() => categoriesQuery.data?.data ?? [], [categoriesQuery.data?.data])
  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data?.data])
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        productMatchesAvailability(product, channelFilter, availabilityFilter),
      ),
    [availabilityFilter, channelFilter, products],
  )
  const editingProduct =
    editingProductId && editingProductId !== 'new'
      ? products.find((product) => product.id === editingProductId) ?? null
      : null

  function duplicateProduct(product: Product) {
    saveProductMutation.mutate({
      ...product,
      id: crypto.randomUUID(),
      name: `${product.name} copia`,
      active: false,
      featured: false,
    })
  }

  return (
    <PageShell>
      <SectionHeader
        title="Produtos"
        description="Catalogo operacional real, com edicao rapida de status, canais e disponibilidade."
        actions={
          canManageProducts ? (
            <Button onClick={() => setEditingProductId('new')}>
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          ) : null
        }
      />

      <section className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_150px_160px_170px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto, categoria, descricao ou tag"
              className="pl-9"
            />
          </label>

          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={channelFilter}
            onValueChange={(value) => setChannelFilter(value as ProductChannel | 'all')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {productChannels.map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {channelLabels[channel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={availabilityFilter}
            onValueChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Disponibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tudo</SelectItem>
              <SelectItem value="available">Disponiveis</SelectItem>
              <SelectItem value="sold_out">Esgotados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#06111f]/92 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
        <div className="grid grid-cols-[minmax(300px,1.55fr)_140px_130px_160px_250px_210px] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Preco</span>
          <span>Status</span>
          <span>Canais</span>
          <span className="text-right">Acoes</span>
        </div>

        {productsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : visibleProducts.length ? (
          <div className="divide-y divide-white/10">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className={cn(
                  'grid grid-cols-[minmax(300px,1.55fr)_140px_130px_160px_250px_210px] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.035]',
                  !product.active && 'opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-100">{product.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">{product.description}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Layers2 className="h-3.5 w-3.5" />
                      {product.optionGroups?.length
                        ? `${product.optionGroups.length} grupo(s) de opcoes`
                        : 'Produto simples'}
                    </div>
                  </div>
                </div>

                <span className="truncate text-sm text-slate-300">
                  {categoryById.get(product.categoryId)?.name ?? 'Sem categoria'}
                </span>
                <span className="font-mono text-sm font-semibold text-orange-300">
                  {formatCurrency(product.price)}
                </span>
                <div className="flex flex-col items-start gap-2">
                  <Badge variant={product.active ? 'success' : 'default'}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {product.availability.some((entry) => entry.soldOut) ? (
                    <span className="text-xs text-red-300">Canal esgotado</span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {productChannels.map((channel) => {
                    const operational = channelIsOperational(product, channel)
                    const availability = product.availability.find((entry) => entry.channel === channel)
                    return (
                      <button
                        key={channel}
                        type="button"
                        disabled={!canManageProducts || updateProductChannelMutation.isPending}
                        onClick={() =>
                          updateProductChannelMutation.mutate({
                            productId: product.id,
                            channel,
                            available: !operational,
                            visible: !operational,
                            soldOut: false,
                          })
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                          operational
                            ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                            : availability?.soldOut
                              ? 'border-red-300/20 bg-red-400/10 text-red-200'
                              : 'border-white/10 bg-white/[0.04] text-muted-foreground',
                        )}
                      >
                        {channelLabels[channel]}
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={product.active ? 'Desativar produto' : 'Ativar produto'}
                    disabled={!canManageProducts || saveProductMutation.isPending}
                    onClick={() => saveProductMutation.mutate({ ...product, active: !product.active })}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Marcar delivery como esgotado"
                    disabled={!canManageProducts || toggleSoldOutMutation.isPending}
                    onClick={() =>
                      toggleSoldOutMutation.mutate({ productId: product.id, channel: 'delivery' })
                    }
                  >
                    <PackageSearch className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Duplicar produto"
                    disabled={!canManageProducts || saveProductMutation.isPending}
                    onClick={() => duplicateProduct(product)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Editar produto"
                    disabled={!canManageProducts}
                    onClick={() => setEditingProductId(product.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={<PackageSearch className="h-5 w-5" />}
              title="Nenhum produto encontrado"
              description="Ajuste os filtros compactos ou cadastre um produto real no catalogo."
            />
          </div>
        )}
      </section>

      <ProductFormDrawer
        key={editingProductId ?? 'closed'}
        product={editingProductId === 'new' ? null : editingProduct}
        categories={categories}
        open={Boolean(editingProductId)}
        onSave={(product) => saveProductMutation.mutate(product)}
        busy={saveProductMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProductId(null)
          }
        }}
      />
    </PageShell>
  )
}
