import { Card, CardContent } from '@/components/ui/card'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { usersMock } from '@/mocks'
import { roleLabelMap } from '@/lib/domain'

export function UsersSettingsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Usuários"
        description="Perfis da loja e permissões da operação, conforme a matriz definida no blueprint."
      />
      <div className="space-y-4">
        {usersMock.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <h3 className="font-semibold">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{roleLabelMap[user.role]}</p>
              </div>
              <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                {user.online ? 'Online' : 'Offline'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
