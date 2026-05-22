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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ProductFormDrawer } from '@/features/catalog/components/ProductFormDrawer'
import {
  useCategoriesQuery,
  useDeleteCategoryMutation,
  useProductsQuery,
  useSaveCategoryMutation,
  useSaveProductMutation,
  useToggleCategorySoldOutMutation,
  useUpdateProductChannelMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Product, ProductChannel } from '@/types'
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  Boxes,
  Eye,
  EyeOff,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'

const productChannels: ProductChannel[] = ['delivery', 'digital_menu', 'counter', 'dine_in']
function createEmptyCategory(sortOrder: number): Category {
  return {
    id: '',
    name: '',
    description: '',
    active: true,
    icon: '',
    color: '#13c8bd',
    visibleOnPos: true,
    visibleOnDigitalMenu: true,
    sortOrder,
    productCount: 0,
  }
}

function productIsSoldOut(product: Product) {
  return product.availability.some((entry) => productChannels.includes(entry.channel) && entry.soldOut)
}

function categoryIsSoldOut(products: Product[]) {
  return products.length > 0 && products.every(productIsSoldOut)
}

export function CategoriesPage() {
  usePageTitle('Categorias')
  const canManageCategories = useCan('catalog:categories:manage')
  const canManageProducts = useCan('catalog:products:manage')
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery({ pageSize: 200 })
  const saveCategoryMutation = useSaveCategoryMutation()
  const deleteCategoryMutation = useDeleteCategoryMutation()
  const saveProductMutation = useSaveProductMutation()
  const updateProductChannelMutation = useUpdateProductChannelMutation()
  const toggleCategorySoldOutMutation = useToggleCategorySoldOutMutation()
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [editingProductId, setEditingProductId] = useState<string | 'new' | null>(null)
  const [productToMoveId, setProductToMoveId] = useState('')
  const [categorySearch, setCategorySearch] = useState('')

  const categories = useMemo(
    () => [...(categoriesQuery.data?.data ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    [categoriesQuery.data?.data],
  )
  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data?.data])
  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        category.name.toLowerCase().includes(categorySearch.trim().toLowerCase()),
      ),
    [categories, categorySearch],
  )
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null
  const selectedProducts = useMemo(
    () =>
      selectedCategory
        ? products
            .filter((product) => product.categoryId === selectedCategory.id)
            .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
        : [],
    [products, selectedCategory],
  )
  const productsOutsideCategory = useMemo(
    () => products.filter((product) => product.categoryId !== selectedCategory?.id),
    [products, selectedCategory?.id],
  )
  const editingProduct =
    editingProductId && editingProductId !== 'new'
      ? products.find((product) => product.id === editingProductId) ?? null
      : null
  const nextSortOrder = categories.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1
  const selectedCategorySoldOut = categoryIsSoldOut(selectedProducts)

  function saveCategory(category: Category) {
    saveCategoryMutation.mutate(category, {
      onSuccess: (response) => {
        setEditingCategory(null)
        setSelectedCategoryId(response.data.id)
      },
    })
  }

  function moveCategory(category: Category, direction: 'up' | 'down') {
    const currentIndex = categories.findIndex((entry) => entry.id === category.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const target = categories[targetIndex]
    if (!target) {
      return
    }

    saveCategoryMutation.mutate({ ...category, sortOrder: target.sortOrder })
    saveCategoryMutation.mutate({ ...target, sortOrder: category.sortOrder })
  }

  function moveProduct(product: Product, direction: 'up' | 'down') {
    const currentIndex = selectedProducts.findIndex((entry) => entry.id === product.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const target = selectedProducts[targetIndex]
    if (!target) {
      return
    }

    saveProductMutation.mutate({ ...product, sortOrder: targetIndex + 1 })
    saveProductMutation.mutate({ ...target, sortOrder: currentIndex + 1 })
  }

  function setProductSoldOut(product: Product, soldOut: boolean) {
    productChannels.forEach((channel) => {
      updateProductChannelMutation.mutate({
        productId: product.id,
        channel,
        available: true,
        visible: true,
        soldOut,
      })
    })
  }

  function toggleSelectedCategorySoldOut(soldOut: boolean) {
    if (!selectedCategory) {
      return
    }

    const message = soldOut
      ? 'Todos os produtos desta categoria ficarao indisponiveis nos canais selecionados. Continuar?'
      : 'Todos os produtos desta categoria serao reativados nos canais selecionados. Continuar?'

    if (!window.confirm(message)) {
      return
    }

    toggleCategorySoldOutMutation.mutate({
      categoryId: selectedCategory.id,
      channels: productChannels,
      soldOut,
    })
  }

  return (
    <PageShell>
      <SectionHeader
        title="Categorias"
        description="Organize as secoes que alimentam PDV, cardapio digital e preview, sem duplicar cadastro."
        actions={
          canManageCategories ? (
            <Button onClick={() => setEditingCategory(createEmptyCategory(nextSortOrder))}>
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          ) : null
        }
      />

      <div className="grid min-h-[680px] gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#071525]/86 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                placeholder="Buscar categoria"
                className="pl-9"
              />
            </label>
          </div>

          <div className="grid grid-cols-[minmax(220px,1.5fr)_100px_130px_170px_190px] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Categoria</span>
            <span>Itens</span>
            <span>Status</span>
            <span>Visibilidade</span>
            <span className="text-right">Acoes</span>
          </div>

          {categoriesQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : filteredCategories.length ? (
            <div className="divide-y divide-white/10">
              {filteredCategories.map((category, index) => {
                const selected = selectedCategory?.id === category.id

                return (
                  <article
                    key={category.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCategoryId(category.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setSelectedCategoryId(category.id)
                      }
                    }}
                    className={cn(
                      'grid cursor-pointer grid-cols-[minmax(220px,1.5fr)_100px_130px_170px_190px] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.035]',
                      selected && 'bg-cyan-400/10 ring-1 ring-inset ring-cyan-300/30',
                      !category.active && 'opacity-60',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-cyan-400/10 text-sm font-semibold text-cyan-200"
                        style={{ color: category.color || undefined }}
                      >
                        {category.icon || category.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-100">{category.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">
                          {category.description || 'Sem descricao'}
                        </p>
                      </div>
                    </div>

                    <p className="font-mono text-sm text-cyan-200">{category.productCount ?? 0}</p>

                    <Badge variant={category.active ? 'success' : 'default'}>
                      {category.active ? 'Ativa' : 'Inativa'}
                    </Badge>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className={category.visibleOnPos ? 'text-cyan-200' : ''}>PDV</span>
                      <span className={category.visibleOnDigitalMenu ? 'text-cyan-200' : ''}>
                        Cardapio digital
                      </span>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Mover para cima"
                        disabled={!canManageCategories || index === 0 || saveCategoryMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          moveCategory(category, 'up')
                        }}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Mover para baixo"
                        disabled={
                          !canManageCategories ||
                          index === filteredCategories.length - 1 ||
                          saveCategoryMutation.isPending
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          moveCategory(category, 'down')
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={category.active ? 'Desativar categoria' : 'Ativar categoria'}
                        disabled={!canManageCategories || saveCategoryMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          saveCategoryMutation.mutate({
                            ...category,
                            active: !category.active,
                            visibleOnPos: !category.active,
                            visibleOnDigitalMenu: !category.active,
                          })
                        }}
                      >
                        {category.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Editar categoria"
                        disabled={!canManageCategories}
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditingCategory(category)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir ou desativar categoria"
                        disabled={!canManageCategories || deleteCategoryMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          deleteCategoryMutation.mutate(category.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-300" />
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={<BookOpenText className="h-5 w-5" />}
                title="Nenhuma categoria encontrada"
                description="Crie categorias reais para organizar o catalogo usado pelo PDV e pelo cardapio digital."
              />
            </div>
          )}
        </section>

        <CategoryProductsPanel
          category={selectedCategory}
          categories={categories}
          products={selectedProducts}
          availableProducts={productsOutsideCategory}
          selectedProductToMove={productToMoveId}
          busy={
            saveProductMutation.isPending ||
            updateProductChannelMutation.isPending ||
            toggleCategorySoldOutMutation.isPending
          }
          canManageProducts={canManageProducts}
          soldOut={selectedCategorySoldOut}
          onSelectProductToMove={setProductToMoveId}
          onAddExistingProduct={() => {
            const product = products.find((entry) => entry.id === productToMoveId)
            if (product && selectedCategory) {
              saveProductMutation.mutate({
                ...product,
                categoryId: selectedCategory.id,
                sortOrder: selectedProducts.length + 1,
              })
              setProductToMoveId('')
            }
          }}
          onCreateProduct={() => setEditingProductId('new')}
          onEditProduct={(productId) => setEditingProductId(productId)}
          onMoveProduct={moveProduct}
          onChangeProductCategory={(product, categoryId) =>
            saveProductMutation.mutate({ ...product, categoryId })
          }
          onToggleProductActive={(product) =>
            saveProductMutation.mutate({ ...product, active: !product.active })
          }
          onToggleProductSoldOut={(product) => setProductSoldOut(product, !productIsSoldOut(product))}
          onToggleCategorySoldOut={toggleSelectedCategorySoldOut}
        />
      </div>

      <Sheet open={Boolean(editingCategory)} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingCategory?.id ? 'Editar categoria' : 'Nova categoria'}</SheetTitle>
            <SheetDescription>
              As alteracoes sao salvas no banco real e afetam PDV, preview e cardapio digital.
            </SheetDescription>
          </SheetHeader>

          {editingCategory ? (
            <CategoryForm
              category={editingCategory}
              busy={saveCategoryMutation.isPending}
              onCancel={() => setEditingCategory(null)}
              onSave={saveCategory}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <ProductFormDrawer
        key={editingProductId ?? 'closed'}
        product={editingProductId === 'new' ? null : editingProduct}
        categories={categories}
        defaultCategoryId={selectedCategory?.id}
        open={Boolean(editingProductId)}
        onSave={(product) =>
          saveProductMutation.mutate({
            ...product,
            categoryId: product.categoryId || selectedCategory?.id || categories[0]?.id || '',
            sortOrder:
              product.sortOrder ||
              (product.categoryId === selectedCategory?.id ? selectedProducts.length + 1 : 0),
          })
        }
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

interface CategoryProductsPanelProps {
  category: Category | null
  categories: Category[]
  products: Product[]
  availableProducts: Product[]
  selectedProductToMove: string
  busy: boolean
  canManageProducts: boolean
  soldOut: boolean
  onSelectProductToMove: (productId: string) => void
  onAddExistingProduct: () => void
  onCreateProduct: () => void
  onEditProduct: (productId: string) => void
  onMoveProduct: (product: Product, direction: 'up' | 'down') => void
  onChangeProductCategory: (product: Product, categoryId: string) => void
  onToggleProductActive: (product: Product) => void
  onToggleProductSoldOut: (product: Product) => void
  onToggleCategorySoldOut: (soldOut: boolean) => void
}

function CategoryProductsPanel({
  category,
  categories,
  products,
  availableProducts,
  selectedProductToMove,
  busy,
  canManageProducts,
  soldOut,
  onSelectProductToMove,
  onAddExistingProduct,
  onCreateProduct,
  onEditProduct,
  onMoveProduct,
  onChangeProductCategory,
  onToggleProductActive,
  onToggleProductSoldOut,
  onToggleCategorySoldOut,
}: CategoryProductsPanelProps) {
  if (!category) {
    return (
      <aside className="rounded-2xl border border-white/10 bg-[#071525]/86 p-5">
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="Selecione uma categoria"
          description="Ao selecionar, os produtos reais vinculados aparecem aqui."
        />
      </aside>
    )
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071525]/86 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Categoria selecionada</p>
            <h2 className="mt-2 truncate text-xl font-semibold text-slate-100">{category.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {category.description || 'Sem descricao'}
            </p>
          </div>
          <Badge variant={category.active ? 'success' : 'default'}>
            {category.active ? 'Ativa' : 'Inativa'}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <InfoPill active={category.visibleOnPos} label="PDV" />
          <InfoPill active={category.visibleOnDigitalMenu} label="Cardapio digital" />
          <InfoPill active={category.active} label="Delivery" />
          <InfoPill active={category.active} label="Salao / Mesas" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!canManageProducts}
            onClick={onCreateProduct}
          >
            <PackagePlus className="h-4 w-4" />
            Novo produto aqui
          </Button>
          <Button
            size="sm"
            variant={soldOut ? 'default' : 'secondary'}
            disabled={!canManageProducts || busy || !products.length}
            onClick={() => onToggleCategorySoldOut(!soldOut)}
          >
            <RefreshCw className="h-4 w-4" />
            {soldOut ? 'Reativar categoria' : 'Marcar categoria como esgotada'}
          </Button>
        </div>
      </div>

      <div className="border-b border-white/10 p-4">
        <p className="mb-2 text-sm font-medium text-slate-200">Adicionar produto existente</p>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Select
            value={selectedProductToMove || undefined}
            onValueChange={onSelectProductToMove}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha um produto de outra categoria" />
            </SelectTrigger>
            <SelectContent>
              {availableProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={!canManageProducts || busy || !selectedProductToMove}
            onClick={onAddExistingProduct}
          >
            Adicionar
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
        {products.length ? (
          <div className="space-y-3">
            {products.map((product, index) => {
              const soldOutProduct = productIsSoldOut(product)

              return (
                <article
                  key={product.id}
                  className="rounded-2xl border border-white/10 bg-[#050f1c] p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <BookOpenText className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-100">{product.name}</h3>
                          <p className="truncate text-sm text-muted-foreground">{product.description}</p>
                        </div>
                        <span className="font-mono text-sm text-orange-300">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={product.active ? 'success' : 'default'}>
                          {product.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {soldOutProduct ? <Badge variant="danger">Esgotado</Badge> : null}
                        {product.optionGroups?.length ? (
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100">
                            Tem opcoes
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <Select
                      value={product.categoryId}
                      onValueChange={(categoryId) => onChangeProductCategory(product, categoryId)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mover para categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Mover produto para cima"
                        disabled={!canManageProducts || busy || index === 0}
                        onClick={() => onMoveProduct(product, 'up')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Mover produto para baixo"
                        disabled={!canManageProducts || busy || index === products.length - 1}
                        onClick={() => onMoveProduct(product, 'down')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={product.active ? 'Inativar produto' : 'Ativar produto'}
                        disabled={!canManageProducts || busy}
                        onClick={() => onToggleProductActive(product)}
                      >
                        {product.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canManageProducts || busy}
                        onClick={() => onToggleProductSoldOut(product)}
                      >
                        {soldOutProduct ? 'Reativar' : 'Esgotar'}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Editar produto"
                        disabled={!canManageProducts}
                        onClick={() => onEditProduct(product.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="Categoria vazia"
            description="Crie um produto aqui ou mova um produto existente para esta categoria."
          />
        )}
      </div>
    </aside>
  )
}

function InfoPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-1',
        active
          ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
          : 'border-white/10 bg-white/[0.04] text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

interface CategoryFormProps {
  category: Category
  busy: boolean
  onCancel: () => void
  onSave: (category: Category) => void
}

function CategoryForm({ category, busy, onCancel, onSave }: CategoryFormProps) {
  const [draft, setDraft] = useState(category)

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <label className="space-y-2 text-sm font-medium text-slate-200">
        Nome
        <Input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="Ex.: Pizzas"
          required
        />
      </label>

      <label className="space-y-2 text-sm font-medium text-slate-200">
        Descricao
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
          className="min-h-24 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          placeholder="Como essa categoria aparece para a operacao"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2 text-sm font-medium text-slate-200">
          Ordem
          <Input
            type="number"
            min={0}
            value={draft.sortOrder}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sortOrder: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-200">
          Cor
          <Input
            value={draft.color ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
            placeholder="#13c8bd"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm font-medium text-slate-200">
        Icone curto
        <Input
          value={draft.icon ?? ''}
          onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}
          placeholder="Ex.: PZ"
          maxLength={3}
        />
      </label>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <SwitchRow
          label="Categoria ativa"
          checked={draft.active}
          onChange={(checked) => setDraft((current) => ({ ...current, active: checked }))}
        />
        <SwitchRow
          label="Aparece no PDV"
          checked={draft.visibleOnPos}
          onChange={(checked) => setDraft((current) => ({ ...current, visibleOnPos: checked }))}
        />
        <SwitchRow
          label="Aparece no cardapio digital"
          checked={draft.visibleOnDigitalMenu}
          onChange={(checked) =>
            setDraft((current) => ({ ...current, visibleOnDigitalMenu: checked }))
          }
        />
      </div>

      <div className="mt-auto flex justify-end gap-3 border-t border-white/10 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || draft.name.trim().length < 2}>
          Salvar categoria
        </Button>
      </div>
    </form>
  )
}

interface SwitchRowProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function SwitchRow({ label, checked, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-200">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
