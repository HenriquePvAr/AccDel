import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePromotionsQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'

export function PromotionsPage() {
  usePageTitle('Promoções')
  const promotionsQuery = usePromotionsQuery()
  const promotions = promotionsQuery.data?.data ?? []

  return (
    <PageShell>
      <SectionHeader
        title="Promoções"
        description="Base comercial da fase atual, com promoções automáticas e estrutura pronta para regras avançadas."
      />
      {promotionsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-[24px]" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {promotions.map((promotion) => (
            <Card key={promotion.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{promotion.name}</h3>
                  <p className="text-sm text-muted-foreground">{promotion.label}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{promotion.status}</p>
                  <p className="text-muted-foreground">{promotion.channel}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}
