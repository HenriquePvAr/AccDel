import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCard } from '@/features/dining/components/TableCard'
import { TableSessionDrawer } from '@/features/dining/components/TableSessionDrawer'
import {
  useAddTableSessionItemMutation,
  useCloseTableSessionMutation,
  useDiningTablesQuery,
  useOpenTableSessionMutation,
  useProductsQuery,
  useSplitTableSessionMutation,
  useTransferTableSessionMutation,
  useUpdateTableSessionMutation,
  useWaitersQuery,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { LayoutGrid } from 'lucide-react'

export function DiningTablesPage() {
  usePageTitle('Salao / Mesas')
  const diningQuery = useDiningTablesQuery()
  const waitersQuery = useWaitersQuery()
  const productsQuery = useProductsQuery({ status: 'active', channel: 'dine_in' })
  const openSessionMutation = useOpenTableSessionMutation()
  const addSessionItemMutation = useAddTableSessionItemMutation()
  const updateSessionMutation = useUpdateTableSessionMutation()
  const closeSessionMutation = useCloseTableSessionMutation()
  const transferSessionMutation = useTransferTableSessionMutation()
  const splitSessionMutation = useSplitTableSessionMutation()
  const [selectedAreaId, setSelectedAreaId] = useState<string | 'all'>('all')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const canManageDining = useCan('dining:update')

  const areas = diningQuery.data?.data.areas ?? []
  const tables = diningQuery.data?.data.tables ?? []
  const sessions = diningQuery.data?.data.sessions ?? []
  const waiters = waitersQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []

  const filteredTables = tables.filter(
    (table) => selectedAreaId === 'all' || table.areaId === selectedAreaId,
  )

  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null
  const selectedSession =
    sessions.find((session) => session.id === selectedTable?.currentSessionId) ?? null

  const stats = {
    free: tables.filter((table) => table.status === 'free').length,
    occupied: tables.filter((table) => table.status === 'occupied').length,
    reserved: tables.filter((table) => table.status === 'reserved').length,
    closing: tables.filter((table) => table.status === 'closing').length,
  }

  const busy =
    openSessionMutation.isPending ||
    addSessionItemMutation.isPending ||
    updateSessionMutation.isPending ||
    closeSessionMutation.isPending ||
    transferSessionMutation.isPending ||
    splitSessionMutation.isPending

  return (
    <PageShell>
      <SectionHeader
        title="Salao / Mesas"
        description="Mapa operacional do salao com sessoes reais, consumo vivo, garcom atribuido e fechamento integrado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedAreaId === 'all' ? 'default' : 'secondary'}
              onClick={() => setSelectedAreaId('all')}
            >
              Todas as areas
            </Button>
            {areas.map((area) => (
              <Button
                key={area.id}
                variant={selectedAreaId === area.id ? 'default' : 'secondary'}
                onClick={() => setSelectedAreaId(area.id)}
              >
                {area.name}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mesas livres"
          value={String(stats.free)}
          trendLabel="Base pronta para giro"
          trendDirection="up"
        />
        <StatCard
          label="Mesas ocupadas"
          value={String(stats.occupied)}
          trendLabel="Consumo em andamento"
          trendDirection="neutral"
        />
        <StatCard
          label="Reservadas"
          value={String(stats.reserved)}
          trendLabel="Pre-operacao"
          trendDirection="neutral"
        />
        <StatCard
          label="Aguardando fechamento"
          value={String(stats.closing)}
          trendLabel="Priorizar caixa"
          trendDirection="down"
        />
      </div>

      {diningQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[196px] rounded-[24px]" />
          ))}
        </div>
      ) : diningQuery.isError ? (
        <EmptyState
          icon={<LayoutGrid className="h-5 w-5" />}
          title="Falha ao carregar o salao"
          description="A API nao retornou mesas e sessoes. Tente novamente para continuar a operacao."
        />
      ) : filteredTables.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              session={sessions.find((session) => session.id === table.currentSessionId)}
              onOpen={setSelectedTableId}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<LayoutGrid className="h-5 w-5" />}
          title="Nenhuma mesa encontrada"
          description="Nao ha mesas para a area selecionada no momento."
        />
      )}

      <TableSessionDrawer
        key={`${selectedTable?.id ?? 'closed'}:${selectedSession?.id ?? 'empty'}`}
        table={selectedTable}
        session={selectedSession}
        tables={tables}
        waiters={waiters}
        products={products}
        open={Boolean(selectedTableId)}
        busy={busy}
        canManage={canManageDining}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTableId(null)
          }
        }}
        onOpenSession={(payload) => openSessionMutation.mutate(payload)}
        onAddItem={(payload) => addSessionItemMutation.mutate(payload)}
        onUpdateSession={(payload) => updateSessionMutation.mutate(payload)}
        onCloseSession={(payload) => closeSessionMutation.mutate(payload)}
        onTransferSession={(payload) => transferSessionMutation.mutate(payload)}
        onSplitSession={(payload) => splitSessionMutation.mutate(payload)}
      />
    </PageShell>
  )
}
