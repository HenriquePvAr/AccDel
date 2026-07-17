import { Users } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsersQuery } from '@/hooks/queries'
import { roleLabelMap } from '@/lib/domain'

export function UsersSettingsPage() {
  const usersQuery = useUsersQuery()
  const users = usersQuery.data?.data ?? []

  return (
    <PageShell>
      <SectionHeader
        title="Usuarios"
        description="Perfis e permissões para cada parte da loja."
      />
      {usersQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[82px] rounded-[24px]" />
          ))}
        </div>
      ) : usersQuery.isError ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Usuarios indisponiveis"
          description="Nao foi possivel carregar os perfis agora."
        />
      ) : users.length ? (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {roleLabelMap[user.role]} - {user.email}
                  </p>
                </div>
                <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                  {user.active ? 'Ativo' : 'Inativo'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Nenhum usuario encontrado"
          description="Nenhum perfil esta vinculado a loja atual."
        />
      )}
    </PageShell>
  )
}
