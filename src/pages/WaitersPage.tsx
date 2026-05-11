import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WaiterCard } from '@/features/dining/components/WaiterCard'
import { WaiterDetailDrawer } from '@/features/dining/components/WaiterDetailDrawer'
import { WaiterFormDrawer } from '@/features/dining/components/WaiterFormDrawer'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import {
  useSaveWaiterMutation,
  useUpdateWaiterStatusMutation,
  useWaiterByIdQuery,
  useWaitersQuery,
} from '@/hooks/queries'
import { formatCompactCurrency } from '@/lib/format'
import { Users } from 'lucide-react'

export function WaitersPage() {
  usePageTitle('Garcons')
  const waitersQuery = useWaitersQuery()
  const saveWaiterMutation = useSaveWaiterMutation()
  const updateStatusMutation = useUpdateWaiterStatusMutation()
  const waiters = waitersQuery.data?.data ?? []
  const [detailWaiterId, setDetailWaiterId] = useState<string | null>(null)
  const [editingWaiterId, setEditingWaiterId] = useState<string | 'new' | null>(null)
  const canManageUsers = useCan('users:manage')
  const detailQuery = useWaiterByIdQuery(detailWaiterId)

  const editingWaiter =
    editingWaiterId && editingWaiterId !== 'new'
      ? waiters.find((entry) => entry.id === editingWaiterId) ?? null
      : null

  return (
    <PageShell>
      <SectionHeader
        title="Garcons"
        description="Cadastro, historico operacional e leitura de performance da equipe de salao."
        actions={
          canManageUsers ? (
            <Button onClick={() => setEditingWaiterId('new')}>Novo garcom</Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Ativos"
          value={String(waiters.filter((entry) => entry.active).length)}
          trendLabel="Equipe habilitada"
          trendDirection="up"
        />
        <StatCard
          label="Atendendo"
          value={String(waiters.filter((entry) => entry.status === 'serving').length)}
          trendLabel="No salao agora"
          trendDirection="neutral"
        />
        <StatCard
          label="Pedidos lancados"
          value={String(waiters.reduce((sum, entry) => sum + entry.totalOrders, 0))}
          trendLabel="Volume operacional"
          trendDirection="up"
        />
        <StatCard
          label="Mesas atendidas"
          value={String(waiters.reduce((sum, entry) => sum + entry.tablesServed, 0))}
          trendLabel="Cobertura do salao"
          trendDirection="up"
        />
        <StatCard
          label="Vendas"
          value={formatCompactCurrency(waiters.reduce((sum, entry) => sum + entry.totalSales, 0))}
          trendLabel="Total do periodo"
          trendDirection="up"
        />
      </div>

      {waitersQuery.isLoading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[300px] rounded-[24px]" />
          ))}
        </div>
      ) : waitersQuery.isError ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Falha ao carregar garcons"
          description="Nao foi possivel buscar a equipe de salao na API. Tente atualizar novamente."
        />
      ) : waiters.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {waiters.map((waiter) => (
            <WaiterCard
              key={waiter.id}
              waiter={waiter}
              busy={updateStatusMutation.isPending}
              onOpen={setDetailWaiterId}
              onEdit={canManageUsers ? setEditingWaiterId : undefined}
              onToggleActive={
                canManageUsers
                  ? (entry) =>
                      updateStatusMutation.mutate({
                        waiterId: entry.id,
                        active: !entry.active,
                        status: entry.active ? 'paused' : 'available',
                      })
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Nenhum garcom cadastrado"
          description="Crie a equipe de salao para distribuir lancamentos, medir ticket medio e acompanhar historico."
        />
      )}

      <WaiterDetailDrawer
        waiter={detailQuery.data?.data ?? null}
        open={Boolean(detailWaiterId)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailWaiterId(null)
          }
        }}
      />

      <WaiterFormDrawer
        key={editingWaiterId ?? 'closed'}
        waiter={editingWaiterId === 'new' ? null : editingWaiter}
        open={Boolean(editingWaiterId)}
        busy={saveWaiterMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWaiterId(null)
          }
        }}
        onSave={(waiter) =>
          saveWaiterMutation.mutate({
            waiter: {
              ...(editingWaiterId && editingWaiterId !== 'new' ? { id: waiter.id } : {}),
              name: waiter.name,
              email: waiter.email ?? '',
              phone: waiter.phone,
              active: waiter.active,
              status: waiter.active ? waiter.status : 'paused',
            },
          })
        }
      />
    </PageShell>
  )
}
