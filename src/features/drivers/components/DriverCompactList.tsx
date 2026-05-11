import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ListFilter, Search } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Driver, DriverLocation } from '@/types'

import { DriverListRow } from './DriverListRow'
import type { DriverSortOption, DriverStatusFilter } from './driver-location-utils'
import { driverSortOptions } from './driver-location-utils'

interface DriverCompactListProps {
  drivers: Driver[]
  totalDrivers: number
  locations: DriverLocation[]
  selectedDriverId: string | null
  onSelectDriver: (driverId: string) => void
  onOpenDispatchCenter: (driverId: string) => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: DriverStatusFilter
  onStatusFilterChange: (value: DriverStatusFilter) => void
  sortBy: DriverSortOption
  onSortByChange: (value: DriverSortOption) => void
}

export function DriverCompactList({
  drivers,
  totalDrivers,
  locations,
  selectedDriverId,
  onSelectDriver,
  onOpenDispatchCenter,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
}: DriverCompactListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const locationsByDriverId = new Map(locations.map((location) => [location.driverId, location]))
  const visibleCount = drivers.length
  const rowVirtualizer = useVirtualizer({
    count: drivers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 82,
    overscan: 8,
  })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-lg font-black text-white">
            {totalDrivers} motoboys
            <span className="ml-2 text-sm font-medium text-slate-500">{visibleCount} visiveis</span>
          </p>
          <p className="text-sm text-slate-400">
            Lista compacta para selecao operacional e leitura rapida de rota.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_170px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar motoboy, pedido ou endereco"
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as DriverStatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: Todos</SelectItem>
              <SelectItem value="delivering">Status: Em entrega</SelectItem>
              <SelectItem value="available">Status: Disponiveis</SelectItem>
              <SelectItem value="paused">Status: Pausados</SelectItem>
              <SelectItem value="offline">Status: Offline</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => onSortByChange(value as DriverSortOption)}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {driverSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  Ordenar: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden border-b border-white/6 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 md:grid md:grid-cols-[minmax(220px,1.35fr)_120px_110px_minmax(220px,1.4fr)_84px_96px_120px]">
        <span>Motoboy</span>
        <span>Status</span>
        <span>Velocidade</span>
        <span>Pedido / rota</span>
        <span>ETA</span>
        <span>Distancia</span>
        <span>Atualizacao</span>
      </div>

      <div ref={parentRef} className="max-h-[420px] overflow-auto scrollbar-thin">
        {drivers.length ? (
          <div
            className="relative"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const driver = drivers[virtualRow.index]

              return (
                <div
                  key={driver.id}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <DriverListRow
                    driver={driver}
                    location={locationsByDriverId.get(driver.id) ?? null}
                    selected={selectedDriverId === driver.id}
                    onSelect={onSelectDriver}
                    onOpenDispatchCenter={onOpenDispatchCenter}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
              <ListFilter className="h-5 w-5" />
            </div>
            <p className="text-base font-black text-white">Nenhum motoboy encontrado</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
              Ajuste a busca ou os filtros para voltar a exibir a operacao no painel.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
