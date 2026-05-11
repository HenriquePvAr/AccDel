import { MessageCircle, Printer, StepForward } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OrderActionBarProps {
  primaryLabel: string
  canUpdate: boolean
  busy?: boolean
  onPrimary: () => void
  onPrintCoupon?: () => void
  onPrintSummary?: () => void
  onContactCustomer?: () => void
  onComplete?: () => void
  completeDisabled?: boolean
}

export function OrderActionBar({
  primaryLabel,
  canUpdate,
  busy = false,
  onPrimary,
  onPrintCoupon,
  onPrintSummary,
  onContactCustomer,
  onComplete,
  completeDisabled = false,
}: OrderActionBarProps) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-white/10 bg-[#06111f]/92 px-4 py-3 backdrop-blur-xl lg:px-0">
      <div className="mx-auto grid max-w-[1500px] gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Button
          type="button"
          disabled={!canUpdate || busy}
          onClick={onPrimary}
          className="h-12 rounded-xl bg-orange-600 font-bold text-white hover:bg-orange-500"
        >
          <StepForward className="h-4 w-4" />
          {busy ? 'Atualizando...' : primaryLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPrintCoupon}
          className="hidden h-12 rounded-xl border-white/10 bg-transparent font-bold text-slate-100 hover:bg-white/[0.06] sm:inline-flex"
        >
          <Printer className="h-4 w-4" />
          Imprimir cupom
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPrintSummary}
          className="hidden h-12 rounded-xl border-white/10 bg-transparent font-bold text-slate-100 hover:bg-white/[0.06] xl:inline-flex"
        >
          <Printer className="h-4 w-4" />
          Imprimir resumo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onContactCustomer}
          className="h-12 rounded-xl border-white/10 bg-transparent font-bold text-slate-100 hover:bg-white/[0.06]"
        >
          <MessageCircle className="h-4 w-4" />
          Falar com cliente
        </Button>
        <Button
          type="button"
          disabled={!canUpdate || completeDisabled || busy}
          onClick={onComplete}
          className={cn(
            'hidden h-12 rounded-xl bg-orange-700 font-bold text-white hover:bg-orange-600 xl:inline-flex',
            completeDisabled && 'opacity-45',
          )}
        >
          Finalizar pedido
        </Button>
      </div>
    </div>
  )
}
