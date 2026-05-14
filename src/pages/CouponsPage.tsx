import { TicketPercent } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCouponsQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'

export function CouponsPage() {
  usePageTitle('Cupons')
  const couponsQuery = useCouponsQuery()
  const coupons = couponsQuery.data?.data ?? []

  return (
    <PageShell>
      <SectionHeader
        title="Cupons"
        description="Cupons comerciais persistidos quando o dominio estiver conectado a API."
      />
      {couponsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-[24px]" />
          ))}
        </div>
      ) : coupons.length ? (
        <div className="space-y-4">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{coupon.code}</h3>
                  <p className="text-sm text-muted-foreground">
                    {coupon.type === 'percent'
                      ? `${coupon.value}%`
                      : `R$ ${coupon.value}`} - minimo R$ {coupon.minOrderAmount}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{coupon.status}</p>
                  <p className="text-muted-foreground">{coupon.channel}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<TicketPercent className="h-5 w-5" />}
          title="Cupons sem fonte real"
          description="Ainda nao existe endpoint persistido para cupons; a tela nao exibe mais dados mockados em modo API."
        />
      )}
    </PageShell>
  )
}
