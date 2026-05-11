import { useEffect, useMemo, useState } from 'react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DriverCard } from '@/features/drivers/components/DriverCard'
import { DriverDetailDrawer } from '@/features/drivers/components/DriverDetailDrawer'
import { DriverFormDrawer } from '@/features/drivers/components/DriverFormDrawer'
import {
  useDriverByIdQuery,
  useDriversQuery,
  useSaveDriverMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { useDriversStore } from '@/stores'

export function DriversPage() {
  usePageTitle('Motoboys')
  const driversQuery = useDriversQuery()
  const saveDriverMutation = useSaveDriverMutation()
  const drivers = useMemo(() => driversQuery.data?.data ?? [], [driversQuery.data?.data])
  const selectedDriverId = useDriversStore((state) => state.selectedDriverId)
  const activeOnly = useDriversStore((state) => state.activeOnly)
  const setSelectedDriverId = useDriversStore((state) => state.setSelectedDriverId)
  const toggleActiveOnly = useDriversStore((state) => state.toggleActiveOnly)
  const [editingDriverId, setEditingDriverId] = useState<string | 'new' | null>(null)
  const [detailDriverId, setDetailDriverId] = useState<string | null>(null)
  const canManageDrivers = useCan('settings:delivery:manage')
  const detailQuery = useDriverByIdQuery(detailDriverId)

  useEffect(() => {
    if (!selectedDriverId && drivers[0]?.id) {
      setSelectedDriverId(drivers[0].id)
    }
  }, [drivers, selectedDriverId, setSelectedDriverId])

  const visibleDrivers = useMemo(
    () =>
      activeOnly
        ? drivers.filter((entry) => (entry.active ?? true) && entry.connectionStatus === 'online')
        : drivers,
    [activeOnly, drivers],
  )

  const editingDriver =
    editingDriverId && editingDriverId !== 'new'
      ? drivers.find((driver) => driver.id === editingDriverId) ?? null
      : null

  return (
    <PageShell>
      <SectionHeader
        title="Motoboys"
        description="Gestao operacional de entregadores com despacho real, historico e leitura rapida da carga atual."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant={activeOnly ? 'default' : 'secondary'} onClick={toggleActiveOnly}>
              {activeOnly ? 'Mostrando so ativos' : 'Filtrar ativos'}
            </Button>
            {canManageDrivers ? (
              <Button onClick={() => setEditingDriverId('new')}>Novo motoboy</Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Ativos agora"
          value={String(drivers.filter((entry) => (entry.active ?? true)).length)}
          trendLabel="Base operacional"
          trendDirection="up"
        />
        <StatCard
          label="Disponiveis"
          value={String(drivers.filter((entry) => entry.availability === 'available').length)}
          trendLabel="Prontos para despacho"
          trendDirection="up"
        />
        <StatCard
          label="Em entrega"
          value={String(drivers.filter((entry) => entry.availability === 'delivering').length)}
          trendLabel="Rotas em andamento"
          trendDirection="neutral"
        />
        <StatCard
          label="Inativos"
          value={String(drivers.filter((entry) => entry.active === false).length)}
          trendLabel="Acesso desligado"
          trendDirection="down"
        />
        <StatCard
          label="Entregas concluidas"
          value={String(drivers.reduce((sum, entry) => sum + (entry.completedOrders ?? 0), 0))}
          trendLabel="Historico acumulado"
          trendDirection="up"
        />
      </div>

      {driversQuery.isLoading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[320px] rounded-[24px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleDrivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              selected={selectedDriverId === driver.id}
              onSelect={(driverId) => {
                setSelectedDriverId(driverId)
                setDetailDriverId(driverId)
              }}
              onEdit={canManageDrivers ? setEditingDriverId : undefined}
            />
          ))}
        </div>
      )}

      <DriverDetailDrawer
        driver={detailQuery.data?.data ?? null}
        open={Boolean(detailDriverId)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDriverId(null)
          }
        }}
      />

      <DriverFormDrawer
        key={editingDriverId ?? 'closed'}
        driver={editingDriverId === 'new' ? null : editingDriver}
        open={Boolean(editingDriverId)}
        busy={saveDriverMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDriverId(null)
          }
        }}
        onSave={(driver) =>
          saveDriverMutation.mutate({
            driver: {
              ...(driver.id ? { id: driver.id } : {}),
              name: driver.name,
              email: driver.email,
              phone: driver.phone,
              vehicle: driver.vehicle,
              active: driver.active,
              availability: driver.availability,
            },
          })
        }
      />
    </PageShell>
  )
}
