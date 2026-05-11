import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategoriesQuery, useProductsQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'

export function CategoriesPage() {
  usePageTitle('Categorias')
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery()
  const categories = categoriesQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []

  return (
    <PageShell>
      <SectionHeader
        title="Categorias"
        description="Estrutura base das categorias do cardápio pronta para reordenação e expansão futura."
      />
      {categoriesQuery.isLoading || productsQuery.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[180px] rounded-[24px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="space-y-2 p-5">
                <h3 className="text-lg font-semibold">{category.name}</h3>
                <p className="text-sm text-muted-foreground">{category.description}</p>
                <p className="font-mono text-sm text-primary">
                  {products.filter((product) => product.categoryId === category.id).length} produtos
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}
