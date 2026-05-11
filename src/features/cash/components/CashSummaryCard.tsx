import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { CashRegister } from '@/types'

interface CashSummaryCardProps {
  register: CashRegister
}

export function CashSummaryCard({ register }: CashSummaryCardProps) {
  return (
    <Card className="p-5 text-slate-100">
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <p className="text-sm text-muted-foreground">Abertura</p>
          <p className="font-mono text-xl font-semibold">{formatCurrency(register.openingAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Esperado</p>
          <p className="font-mono text-xl font-semibold">{formatCurrency(register.expectedAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Contado</p>
          <p className="font-mono text-xl font-semibold">{formatCurrency(register.countedAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Diferença</p>
          <p className="font-mono text-xl font-semibold">{formatCurrency(register.differenceAmount)}</p>
        </div>
      </div>
    </Card>
  )
}
