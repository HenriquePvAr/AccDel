import { Card, CardContent } from '@/components/ui/card'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'

export function DeliverySettingsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Configurações de delivery"
        description="Faixas de entrega, motoboys e sugestões de rota entrarão aqui nas próximas etapas."
      />
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <p className="text-sm text-muted-foreground">Raio padrão</p>
            <p className="font-semibold">7 km</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <p className="text-sm text-muted-foreground">Despacho automático</p>
            <p className="font-semibold">Manual assistido</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <p className="text-sm text-muted-foreground">Lote multi-entrega</p>
            <p className="font-semibold">Habilitado</p>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  )
}
