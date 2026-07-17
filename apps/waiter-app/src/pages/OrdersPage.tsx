import { useQuery } from '@tanstack/react-query'
import { ChefHat, CircleCheck, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/States'
import { apiRequest } from '@/lib/api'
import { elapsedTime } from '@/lib/format'
import { useWaiterRealtime } from '@/lib/realtime'
import type { RoomSnapshot } from '@/types'

export function OrdersPage() {
  const query = useQuery({
    queryKey: ['waiter', 'tables'],
    queryFn: () => apiRequest<{ data: RoomSnapshot }>('/waiter/tables'),
  })
  useWaiterRealtime(() => void query.refetch())

  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
  const sessions = query.data.data.sessions.filter((session) => session.status !== 'closed')

  return (
    <section className="page orders-page">
      <div className="page-heading"><div><span className="eyebrow">Acompanhamento</span><h1>Pedidos do salão</h1></div></div>
      {!sessions.length ? <EmptyState title="Nenhum pedido ativo" description="As comandas abertas aparecerão aqui." /> : (
        <div className="active-order-list">
          {sessions.map((session) => {
            const ready = session.items.filter((item) => item.productionStatus === 'ready' && !item.deliveredAt && !item.cancelledAt).length
            const production = session.items.filter((item) => item.productionStatus === 'in_preparation' && !item.cancelledAt).length
            return (
              <Link to={`/mesas/${session.tableId}`} className={ready ? 'active-order ready' : 'active-order'} key={session.id}>
                <div><span className="eyebrow">Mesa</span><strong>{session.tableCode}</strong></div>
                <div className="active-order-counts">
                  <span><ChefHat size={17} /> {production} em preparo</span>
                  <span><CircleCheck size={17} /> {ready} prontos</span>
                  <span><Clock3 size={17} /> {elapsedTime(session.openedAt)}</span>
                </div>
                <span className="active-order-link">Abrir comanda →</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
