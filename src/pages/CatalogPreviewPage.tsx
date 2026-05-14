import { Sparkles } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCategoriesQuery,
  useProductsQuery,
  usePromotionsQuery,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { PreviewPhoneFrame } from '@/features/preview/components/PreviewPhoneFrame'
import { formatCurrency } from '@/lib/format'
import { usePreviewStore } from '@/stores'

export function CatalogPreviewPage() {
  usePageTitle('Prévia do cardápio digital')
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery()
  const promotionsQuery = usePromotionsQuery()
  const categories = categoriesQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []
  const promotions = promotionsQuery.data?.data ?? []
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
  const isLoading =
    categoriesQuery.isLoading || productsQuery.isLoading || promotionsQuery.isLoading

  const visibleProducts = products.filter((product) =>
    product.availability.some(
      (entry) => entry.channel === channel && entry.visible && entry.available,
    ),
  )

  return (
    <PageShell>
      <SectionHeader
        title="Prévia do cardápio digital"
        description="A mesma visão que o cliente enxerga, dentro do admin e sem duplicar a lógica visual do catálogo."
        actions={
          <div className="flex gap-2">
            <Button
              variant={channel === 'digital_menu' ? 'default' : 'secondary'}
              onClick={() => setChannel('digital_menu')}
            >
              Cardápio digital
            </Button>
            <Button
              variant={channel === 'delivery' ? 'default' : 'secondary'}
              onClick={() => setChannel('delivery')}
            >
              Delivery
            </Button>
          </div>
        }
      />

      <PreviewPhoneFrame>
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-36 rounded-[28px]" />
            <Skeleton className="h-24 rounded-[24px]" />
            <Skeleton className="h-52 rounded-[26px]" />
          </div>
        ) : (
          <div className="space-y-5 p-4">
            <div className="rounded-[28px] bg-[linear-gradient(135deg,#1F252B_0%,#C65D2E_110%)] p-5 text-white">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/70">
                <Sparkles className="h-4 w-4" />
                Preview cliente
              </div>
              <h2 className="mt-3 text-2xl font-bold">Cain Delivery</h2>
              <p className="mt-2 text-sm text-white/75">
                Burgers premium, combos e delivery com operação própria.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant={selectedCategoryId === category.id ? 'default' : 'secondary'}
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              <div className="rounded-[24px] bg-brand-soft p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Promoções ativas
                </p>
                <div className="mt-2 space-y-2">
                  {promotions.map((promotion) => (
                    <div key={promotion.id} className="rounded-2xl bg-white/85 px-3 py-3">
                      <p className="font-semibold">{promotion.name}</p>
                      <p className="text-sm text-muted-foreground">{promotion.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {visibleProducts
                .filter((product) => !selectedCategoryId || product.categoryId === selectedCategoryId)
                .map((product) => {
                  const availability = product.availability.find((entry) => entry.channel === channel)

                  return (
                    <div
                      key={product.id}
                      className="overflow-hidden rounded-[26px] border border-border bg-white"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-40 w-full object-cover"
                      />
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                          </div>
                          <span className="font-mono text-sm">{formatCurrency(product.price)}</span>
                        </div>
                        {availability?.soldOut ? (
                          <div className="rounded-2xl bg-status-danger/10 px-3 py-2 text-sm font-medium text-status-danger">
                            Indisponível neste canal
                          </div>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() =>
                              addCartItem({
                                productId: product.id,
                                name: product.name,
                                price: product.price,
                              })
                            }
                          >
                            Adicionar ao carrinho
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>

            {!visibleProducts.length ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="Nada visível neste canal"
                description="A prévia já respeita as disponibilidades persistidas do catálogo."
              />
            ) : null}

            <div className="sticky bottom-3 rounded-[26px] bg-graphite p-4 text-white shadow-panel">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Carrinho da previa</span>
                <div className="flex items-center gap-2">
                  <span>{cartItems.length} itens</span>
                  <Button variant="secondary" size="sm" onClick={clearCart}>
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-sm"
                  >
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCartItem(item.productId)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </PreviewPhoneFrame>
    </PageShell>
  )
}
