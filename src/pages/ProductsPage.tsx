import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar } from '@/components/shared/FilterBar'
import { PageShell } from '@/components/shared/PageShell'
import { SearchInput } from '@/components/shared/SearchInput'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/features/catalog/components/ProductCard'
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
import type { ProductChannel } from '@/types'
import { PackageSearch } from 'lucide-react'

export function ProductsPage() {
  usePageTitle('Produtos')
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [channelFilter, setChannelFilter] = useState<ProductChannel | 'all'>('all')
  const [editingProductId, setEditingProductId] = useState<string | 'new' | null>(null)
  const canManageProducts = useCan('catalog:products:manage')
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery({
    search,
    categoryId: selectedCategoryId,
    status: statusFilter,
    channel: channelFilter,
  })
  const saveProductMutation = useSaveProductMutation()
  const toggleSoldOutMutation = useToggleProductSoldOutMutation()
  const updateProductChannelMutation = useUpdateProductChannelMutation()

  const categories = categoriesQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []
  const editingProduct =
    editingProductId && editingProductId !== 'new'
      ? products.find((product) => product.id === editingProductId) ?? null
      : null

  return (
    <PageShell>
      <SectionHeader
        title="Produtos"
        description="Gestao operacional do catalogo com filtros por status, canal, setor e acoes rapidas por card."
        actions={
          canManageProducts ? (
            <Button onClick={() => setEditingProductId('new')}>Novo produto</Button>
          ) : null
        }
      />

      <FilterBar className="grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr]">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por produto, descricao ou tag"
        />
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          <Button
            variant={selectedCategoryId === 'all' ? 'default' : 'secondary'}
            onClick={() => setSelectedCategoryId('all')}
          >
            Todas as categorias
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategoryId === category.id ? 'default' : 'secondary'}
              onClick={() => setSelectedCategoryId(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          {(['all', 'active', 'inactive'] as const).map((entry) => (
            <Button
              key={entry}
              variant={statusFilter === entry ? 'default' : 'secondary'}
              onClick={() => setStatusFilter(entry)}
            >
              {entry === 'all' ? 'Todos os status' : entry === 'active' ? 'Ativos' : 'Inativos'}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          {(['all', 'delivery', 'dine_in', 'digital_menu', 'counter'] as const).map((entry) => (
            <Button
              key={entry}
              variant={channelFilter === entry ? 'default' : 'secondary'}
              onClick={() => setChannelFilter(entry)}
            >
              {entry === 'all' ? 'Todos os canais' : entry}
            </Button>
          ))}
        </div>
      </FilterBar>

      {productsQuery.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[520px] rounded-[24px]" />
          ))}
        </div>
      ) : products.length ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={setEditingProductId}
              onToggleSoldOut={(productId) =>
                toggleSoldOutMutation.mutate({ productId, channel: 'delivery' })
              }
              onToggleActive={(productId) => {
                const current = products.find((entry) => entry.id === productId)
                if (!current) {
                  return
                }

                saveProductMutation.mutate({
                  ...current,
                  active: !current.active,
                })
              }}
              onToggleChannelAvailability={(productId, channel, available) =>
                updateProductChannelMutation.mutate({
                  productId,
                  channel,
                  available,
                  visible: available,
                  soldOut: false,
                })
              }
              canManage={canManageProducts}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<PackageSearch className="h-5 w-5" />}
          title="Nenhum produto encontrado"
          description="Ajuste os filtros ou crie um novo item para alimentar o catalogo."
        />
      )}

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
