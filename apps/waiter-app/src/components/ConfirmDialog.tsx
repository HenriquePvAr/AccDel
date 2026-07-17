import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm(): void
  onClose(): void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (props.open && !dialog.open) dialog.showModal()
    if (!props.open && dialog.open) dialog.close()
  }, [props.open])

  return (
    <dialog ref={dialogRef} className="dialog" onCancel={props.onClose} onClose={props.onClose}>
      <button className="icon-button dialog-close" type="button" aria-label="Fechar" onClick={props.onClose}>
        <X size={20} />
      </button>
      <h2>{props.title}</h2>
      <div className="dialog-description">{props.description}</div>
      <div className="dialog-actions">
        <button className="button ghost" type="button" onClick={props.onClose}>Voltar</button>
        <button
          className={`button ${props.destructive ? 'danger' : 'primary'}`}
          type="button"
          disabled={props.busy}
          onClick={props.onConfirm}
        >
          {props.busy ? 'Processando…' : props.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
