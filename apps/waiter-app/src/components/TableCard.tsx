import { Clock3, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { elapsedTime } from '@/lib/format'
import type { DiningTable, TableSession } from '@/types'
import { TableStatusBadge } from './StatusBadge'

export function TableCard({ table, session }: { table: DiningTable; session?: TableSession }) {
  const readyCount = session?.items.filter((item) => item.productionStatus === 'ready' && !item.deliveredAt && !item.cancelledAt).length ?? 0
  const productionCount = session?.items.filter((item) => item.productionStatus === 'in_preparation' && !item.cancelledAt).length ?? 0

  return (
    <Link className={`table-card status-${table.status}`} to={`/mesas/${table.id}`} aria-label={`Mesa ${table.code}, ${table.status}`}>
      <div className="table-card-head">
        <div>
          <span className="eyebrow">Mesa</span>
          <strong>{table.code}</strong>
        </div>
        <TableStatusBadge status={table.status} />
      </div>
      <div className="table-card-meta">
        <span><Users size={16} aria-hidden="true" /> {session?.guestCount ?? table.capacity} {session ? 'pessoas' : 'lugares'}</span>
        {session && <span><Clock3 size={16} aria-hidden="true" /> {elapsedTime(session.openedAt)}</span>}
      </div>
      {session ? (
        <div className="table-card-foot">
          <span>{session.waiterName ?? 'Sem responsável'}</span>
          <span>{readyCount ? `${readyCount} pronto${readyCount > 1 ? 's' : ''}` : `${productionCount} em preparo`}</span>
        </div>
      ) : (
        <div className="table-card-foot"><span>Toque para abrir</span><span>Disponível</span></div>
      )}
    </Link>
  )
}
