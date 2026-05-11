import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmActionDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  onOpenChange,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
