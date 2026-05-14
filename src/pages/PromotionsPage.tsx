import { Megaphone } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePromotionsQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'

export function PromotionsPage() {
  usePageTitle('Promocoes')
  const promotionsQuery = usePromotionsQuery()
  const promotions = promotionsQuery.data?.data ?? []

  return (
    <PageShell>
      <SectionHeader
        title="Promocoes"
        description="Regras comerciais persistidas quando o dominio estiver conectado a API."
      />
      {promotionsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-[24px]" />
          ))}
        </div>
      ) : promotions.length ? (
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
      ) : (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title="Promocoes sem fonte real"
          description="Ainda nao existe endpoint persistido para promocoes; a tela nao exibe mais dados mockados em modo API."
        />
      )}
    </PageShell>
  )
}
