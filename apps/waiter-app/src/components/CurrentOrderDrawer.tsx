import { ChevronDown, Send, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { currency } from '@/lib/format'
import type { DraftItem } from '@/types'
import { QuantityStepper } from './QuantityStepper'

interface CurrentOrderDrawerProps {
  items: DraftItem[]
  open: boolean
  sending: boolean
  online: boolean
  currentUserName?: string
  onOpen(): void
  onClose(): void
  onQuantity(clientId: string, quantity: number): void
  onRemove(clientId: string): void
  onSend(): void
}

export function CurrentOrderDrawer(props: CurrentOrderDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (props.open && !dialog.current?.open) dialog.current?.showModal()
    if (!props.open && dialog.current?.open) dialog.current.close()
  }, [props.open])
  const total = props.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const count = props.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <>
      {props.items.length > 0 && (
        <button className="draft-bar" type="button" onClick={props.onOpen} aria-label={`Abrir seleção com ${count} itens`}>
          <span><ShoppingBag size={20} /><strong>{count}</strong> ainda não enviado{count > 1 ? 's' : ''}</span>
          <span>{currency.format(total)} <span aria-hidden="true">↑</span></span>
        </button>
      )}
      <dialog ref={dialog} className="order-drawer" onCancel={props.onClose} onClose={props.onClose}>
        <header><div><span className="eyebrow">Seleção temporária</span><h2>Revisar itens</h2></div><button className="icon-button" type="button" aria-label="Fechar seleção" onClick={props.onClose}><ChevronDown /></button></header>
        <div className="draft-list">
          {props.items.map((item) => (
            <article className="draft-row" key={item.clientId}>
              <div>
                <strong>{item.name}</strong>
                {item.optionLabels.length > 0 && <small>{item.optionLabels.join(' · ')}</small>}
                {item.notes && <small>Obs.: {item.notes}</small>}
                <small>{props.currentUserName ? `Agora · ${props.currentUserName}` : 'Agora · por você'}</small>
                <span>{currency.format(item.unitPrice * item.quantity)}</span>
              </div>
              <div className="draft-row-actions"><QuantityStepper value={item.quantity} onChange={(quantity) => props.onQuantity(item.clientId, quantity)} /><button className="icon-button danger-text" type="button" aria-label={`Remover ${item.name}`} onClick={() => props.onRemove(item.clientId)}><Trash2 size={19} /></button></div>
            </article>
          ))}
        </div>
        <footer>
          {!props.online && <p className="drawer-warning">Sem conexão: o rascunho está preservado, mas não será enviado.</p>}
          <div><span>Total recalculado pelo backend no envio</span><strong>{currency.format(total)}</strong></div>
          <button className="button primary send-button" type="button" disabled={!props.items.length || props.sending || !props.online} onClick={props.onSend}><Send size={19} /> {props.sending ? 'Enviando…' : 'Enviar para produção'}</button>
        </footer>
      </dialog>
    </>
  )
}
