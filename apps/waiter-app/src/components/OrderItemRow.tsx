import { Ban, Check, Clock3 } from 'lucide-react'

import { currency, itemLaunchMeta } from '@/lib/format'
import type { SessionItem } from '@/types'
import { PrintStatusBadge, ProductionStatusBadge } from './StatusBadge'

export function OrderItemRow({ item, onCancel, onDeliver }: { item: SessionItem; onCancel?(): void; onDeliver?(): void }) {
  const optionNames = item.options.flatMap((option) => typeof option.name === 'string' ? [option.name] : [])
  return (
    <article className={`order-item-row ${item.productionStatus === 'ready' && !item.deliveredAt ? 'is-ready' : ''} ${item.cancelledAt ? 'is-cancelled' : ''}`}>
      <div className="item-quantity">{item.quantity}×</div>
      <div className="item-copy">
        <div className="item-title"><strong>{item.name}</strong><span>{currency.format(item.totalPrice)}</span></div>
        {optionNames.length > 0 && <small>{optionNames.join(' · ')}</small>}
        {item.notes && <small>Obs.: {item.notes}</small>}
        {item.cancelReason && <small>Motivo: {item.cancelReason}</small>}
        <div className="item-labels">
          <ProductionStatusBadge status={item.productionStatus} />
          <PrintStatusBadge status={item.printStatus} />
          <span className="item-time" aria-label={`Lançado às ${itemLaunchMeta(item.createdAt, item.createdByName)}`}>
            <Clock3 size={14} /> {itemLaunchMeta(item.createdAt, item.createdByName)}
          </span>
        </div>
      </div>
      <div className="item-actions">
        {onDeliver && <button className="button ready-action" type="button" onClick={onDeliver}><Check size={18} /> Entregar</button>}
        {onCancel && <button className="icon-button danger-text" type="button" aria-label={`Cancelar ${item.name}`} onClick={onCancel}><Ban size={18} /></button>}
      </div>
    </article>
  )
}
