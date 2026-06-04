import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCatalogMenuSourceQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePreviewStore } from '@/stores'
import type { CatalogMenuCategory, CatalogMenuProduct, ProductChannel, Promotion } from '@/types'
import {
  AlertTriangle,
  Clock3,
  Globe2,
  Monitor,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

type PreviewMode = 'desktop' | 'mobile'

function promotionTypeLabel(type: Promotion['type']) {
  return type === 'percent' ? 'Desconto percentual' : type === 'fixed' ? 'Desconto fixo' : 'Combo'
}

function channelLabel(channel: ProductChannel) {
  return channel === 'digital_menu' ? 'Cardapio digital' : 'Delivery'
}

function getProductStatus(product: CatalogMenuProduct) {
  const availability = product.channelAvailability
  if (!product.active) {
    return { label: 'inativo', tone: 'neutral' as const, available: false }
  }
  if (!availability || !availability.visible || !availability.available) {
    return { label: 'indisponivel neste canal', tone: 'warning' as const, available: false }
  }
  if (availability.soldOut) {
    return { label: 'esgotado', tone: 'danger' as const, available: false }
  }

  return { label: 'disponivel', tone: 'success' as const, available: true }
}

function productMatchesSearch(
  product: CatalogMenuProduct,
  category: CatalogMenuCategory | undefined,
  search: string,
) {
  const normalized = search.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    product.name.toLowerCase().includes(normalized) ||
    product.description.toLowerCase().includes(normalized) ||
    product.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
    (category?.name ?? '').toLowerCase().includes(normalized)
  )
}

export function CatalogPreviewPage() {
  usePageTitle('Previa do cardapio digital')
  const [mode, setMode] = useState<PreviewMode>('desktop')
  const [search, setSearch] = useState('')
  const [
    channel,
    setChannel,
    selectedCategoryId,
    setSelectedCategoryId,
    cartItems,
    addCartItem,
    removeCartItem,
    clearCart,
  ] = usePreviewStore(
    useShallow((state) => [
      state.channel,
      state.setChannel,
      state.selectedCategoryId,
      state.setSelectedCategoryId,
      state.cartItems,
      state.addCartItem,
      state.removeCartItem,
      state.clearCart,
    ]),
  )
  const menuSourceQuery = useCatalogMenuSourceQuery({
    channel,
    includeUnavailable: true,
  })
  const isLoading = menuSourceQuery.isLoading
  const source = menuSourceQuery.data?.data
  const categories = useMemo(
    () => source?.categories.filter((category) => category.visibleForChannel) ?? [],
    [source?.categories],
  )
  const allProducts = useMemo(
    () => categories.flatMap((category) => category.products),
    [categories],
  )
  const promotions = source?.promotions ?? []
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null
  const previewProducts = useMemo(
    () =>
      allProducts.filter((product) => {
        const category = categoryById.get(product.categoryId)
        const categoryVisible = categories.some((entry) => entry.id === product.categoryId)
        const matchesCategory = !selectedCategory || product.categoryId === selectedCategory.id

        return (
          categoryVisible &&
          matchesCategory &&
          productMatchesSearch(product, category, search)
        )
      }),
    [allProducts, categories, categoryById, search, selectedCategory],
  )
  const visibleCategoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  )
  const warnings = useMemo(() => {
    const productsWithoutImage = allProducts.filter(
      (product) => visibleCategoryIds.has(product.categoryId) && !product.image,
    ).length
    const emptyCategories = categories.filter(
      (category) => !allProducts.some((product) => product.categoryId === category.id),
    ).length
    const unavailableProducts = allProducts.filter((product) => {
      const status = getProductStatus(product)
      return visibleCategoryIds.has(product.categoryId) && !status.available
    }).length

    return { productsWithoutImage, emptyCategories, unavailableProducts }
  }, [allProducts, categories, visibleCategoryIds])
  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)

  return (
    <PageShell>
      <SectionHeader
        title="Previa do cardapio digital"
        description="Veja como o cliente percebe o cardapio usando as mesmas categorias, produtos e disponibilidades do banco."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={channel === 'digital_menu' ? 'default' : 'secondary'}
              onClick={() => setChannel('digital_menu')}
            >
              <Globe2 className="h-4 w-4" />
              Cardapio digital
            </Button>
            <Button
              variant={channel === 'delivery' ? 'default' : 'secondary'}
              onClick={() => setChannel('delivery')}
            >
              <ShoppingBag className="h-4 w-4" />
              Delivery
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Modo de previa</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant={mode === 'desktop' ? 'default' : 'secondary'}
                onClick={() => setMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
                Desktop
              </Button>
              <Button
                variant={mode === 'mobile' ? 'default' : 'secondary'}
                onClick={() => setMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
                Mobile
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#071525]/86 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-100">
              <AlertTriangle className="h-4 w-4" />
              Pontos de atencao
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <WarningRow label="Produtos sem imagem" value={warnings.productsWithoutImage} />
              <WarningRow label="Categorias vazias" value={warnings.emptyCategories} />
              <WarningRow label="Indisponiveis no canal" value={warnings.unavailableProducts} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link to="/catalog/products">Editar produtos</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/catalog/categories">Editar categorias</Link>
              </Button>
            </div>
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-[#030b15] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.3)]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          ) : (
            <div
              className={cn(
                'mx-auto overflow-hidden rounded-[28px] border border-white/10 bg-[#f7f4ef] text-[#16202a] shadow-[0_24px_80px_rgba(0,0,0,0.35)]',
                mode === 'mobile' ? 'max-w-[390px]' : 'max-w-[1180px]',
              )}
            >
              <div className="border-b border-black/10 bg-[#101923] p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cyan-100/80">
                      <Store className="h-4 w-4" />
                      Cain Burger House
                    </div>
                    <h2 className="mt-3 text-3xl font-bold tracking-normal">
                      Cardapio online
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/70">
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-100">
                        Aberta agora
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        35-45 min
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {channelLabel(channel)}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-[220px] rounded-2xl border border-white/10 bg-white/10 p-3">
                    <p className="text-xs text-white/60">Carrinho</p>
                    <p className="mt-1 text-xl font-semibold">{formatCurrency(cartTotal)}</p>
                    <p className="text-sm text-white/60">{cartItems.length} item(ns)</p>
                  </div>
                </div>

                <label className="relative mt-5 block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar produto, categoria ou ingrediente"
                    className="border-white/10 bg-white/10 pl-11 text-white placeholder:text-white/45"
                  />
                </label>
              </div>

              <div className="border-b border-black/10 bg-white/80 px-5 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={cn(
                        'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
                        selectedCategory?.id === category.id
                          ? 'border-[#e85d24] bg-[#e85d24] text-white shadow-[0_10px_24px_rgba(232,93,36,0.28)]'
                          : 'border-black/10 bg-white text-[#425466]',
                      )}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {promotions.length ? (
                <div className="border-b border-black/10 bg-[#fff7ed] px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#9a3412]">
                    <Sparkles className="h-4 w-4" />
                    Promocoes ativas
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {promotions.slice(0, 2).map((promotion) => (
                      <div key={promotion.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <p className="font-semibold">{promotion.name}</p>
                        <p className="text-sm text-[#637083]">
                          {promotion.description || promotionTypeLabel(promotion.type)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                className={cn(
                  'grid gap-4 p-5',
                  mode === 'mobile' ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_300px]',
                )}
              >
                <div>
                  {previewProducts.length ? (
                    <div
                      className={cn(
                        'grid gap-4',
                        mode === 'mobile' ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3',
                      )}
                    >
                      {previewProducts.map((product) => {
                        const status = getProductStatus(product)
                        const category = categoryById.get(product.categoryId)

                        return (
                          <article
                            key={product.id}
                            className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
                          >
                            <div className="h-36 bg-[#111827]">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-white/50">
                                  Sem imagem
                                </div>
                              )}
                            </div>
                            <div className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                                    {category?.name ?? 'Sem categoria'}
                                  </p>
                                  <h3 className="mt-1 line-clamp-1 font-semibold">{product.name}</h3>
                                  <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
                                    {product.description}
                                  </p>
                                </div>
                                <span className="shrink-0 font-mono text-sm font-semibold text-[#e85d24]">
                                  {formatCurrency(product.price)}
                                </span>
                              </div>
                              {product.optionGroups.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {product.optionGroups.flatMap((group) =>
                                    group.options.slice(0, 5).map((option) => (
                                      <span
                                        key={`${group.id}-${option.id}`}
                                        className={cn(
                                          'rounded-full border px-2 py-1 text-[11px] font-semibold',
                                          option.orderable !== false
                                            ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                            : 'border-red-200 bg-red-50 text-red-700',
                                        )}
                                      >
                                        {option.name}
                                      </span>
                                    )),
                                  )}
                                </div>
                              ) : null}
                              <div className="flex items-center justify-between gap-3">
                                <ClientStatusBadge status={status} />
                                {status.available ? (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      addCartItem({
                                        productId: product.id,
                                        name: product.name,
                                        price: product.price,
                                      })
                                    }
                                  >
                                    Adicionar
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="secondary" disabled>
                                    Indisponivel
                                  </Button>
                                )}
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Sparkles className="h-5 w-5" />}
                      title="Nada aparece nesta previa"
                      description="Ajuste busca, categorias ou disponibilidade do canal selecionado."
                    />
                  )}
                </div>

                {mode === 'desktop' ? (
                  <aside className="h-fit rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Seu pedido</h3>
                      <Button variant="ghost" size="sm" onClick={clearCart}>
                        Limpar
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {cartItems.length ? (
                        cartItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-[#f1f5f9] px-3 py-2 text-sm"
                          >
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <button
                              type="button"
                              className="text-[#e85d24]"
                              onClick={() => removeCartItem(item.productId)}
                            >
                              Remover
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-xl bg-[#f1f5f9] px-3 py-4 text-sm text-[#64748b]">
                          O carrinho da previa fica aqui no desktop.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
                      <span className="font-semibold">Total</span>
                      <span className="font-mono font-semibold">{formatCurrency(cartTotal)}</span>
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  )
}

function WarningRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
      <span>{label}</span>
      <span className={value ? 'font-mono text-orange-200' : 'font-mono text-emerald-200'}>
        {value}
      </span>
    </div>
  )
}

function ClientStatusBadge({ status }: { status: ReturnType<typeof getProductStatus> }) {
  const className =
    status.tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : status.tone === 'danger'
        ? 'bg-red-100 text-red-700'
        : status.tone === 'warning'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600'

  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', className)}>
      {status.label}
    </span>
  )
}
