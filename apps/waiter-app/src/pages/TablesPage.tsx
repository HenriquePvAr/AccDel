import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/States'
import { TableCard } from '@/components/TableCard'
import { apiRequest } from '@/lib/api'
import { useWaiterRealtime } from '@/lib/realtime'
import type { RoomSnapshot, TableStatus } from '@/types'

const statusFilters: Array<{ value: 'all' | TableStatus; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'free', label: 'Livres' },
  { value: 'occupied', label: 'Ocupadas' },
  { value: 'closing', label: 'Fechamento' },
]

export function TablesPage() {
  const [areaId, setAreaId] = useState('all')
  const [status, setStatus] = useState<'all' | TableStatus>('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['waiter', 'tables'],
    queryFn: () => apiRequest<{ data: RoomSnapshot }>('/waiter/tables'),
    refetchInterval: 45_000,
  })
  useWaiterRealtime(() => void query.refetch())

  const tables = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR')
    return (query.data?.data.tables ?? []).filter((table) => {
      if (areaId !== 'all' && table.areaId !== areaId) return false
      if (status !== 'all' && table.status !== status) return false
      return !normalized || table.code.toLocaleLowerCase('pt-BR').includes(normalized)
    })
  }, [areaId, query.data, search, status])

  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
  const room = query.data.data

  return (
    <section className="page room-page">
      <div className="page-heading">
        <div><span className="eyebrow">Salão em tempo real</span><h1>Mesas</h1></div>
        <div className="room-summary" aria-label="Resumo do salão">
          <span><strong>{room.tables.filter((table) => table.status === 'free').length}</strong> livres</span>
          <span><strong>{room.tables.filter((table) => table.status === 'occupied').length}</strong> ocupadas</span>
          <span><strong>{room.tables.filter((table) => table.status === 'closing').length}</strong> fechando</span>
        </div>
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Buscar mesa</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mesa" />
        </label>
        <label className="select-field">
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span className="sr-only">Filtrar por área</span>
          <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="all">Todas as áreas</option>
            {room.areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}
          </select>
        </label>
      </div>

      <div className="segmented-control" aria-label="Filtrar por status">
        {statusFilters.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={status === filter.value ? 'active' : ''}
            onClick={() => setStatus(filter.value)}
          >{filter.label}</button>
        ))}
      </div>

      {tables.length ? (
        <div className="table-grid">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              session={room.sessions.find((session) => session.id === table.currentSessionId)}
            />
          ))}
        </div>
      ) : <EmptyState title="Nenhuma mesa encontrada" description="Ajuste os filtros ou o texto da busca." />}
    </section>
  )
}
