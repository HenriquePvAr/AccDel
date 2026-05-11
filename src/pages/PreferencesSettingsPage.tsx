import { Card, CardContent } from '@/components/ui/card'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'

export function PreferencesSettingsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Preferências"
        description="Preferências de UI, densidade operacional e comportamento do painel para cada perfil."
      />
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <p className="text-sm text-muted-foreground">Densidade do kanban</p>
            <p className="font-semibold">Compacta</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <p className="text-sm text-muted-foreground">Alertas sonoros</p>
            <p className="font-semibold">Apenas exceções</p>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  )
}
