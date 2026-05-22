import { useState } from 'react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CashSummaryCard } from '@/features/cash/components/CashSummaryCard'
import {
  useCashRegisterQuery,
  useCloseCashRegisterMutation,
  useRegisterCashMovementMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { paymentLabelMap } from '@/lib/domain'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { CashMovementType } from '@/types'

const movementTypeOptions: Array<{ value: CashMovementType; label: string; description: string }> = [
  { value: 'supply', label: 'Suprimento', description: 'Entrada manual no caixa.' },
  { value: 'withdrawal', label: 'Sangria', description: 'Retirada manual de valor.' },
  { value: 'adjustment', label: 'Ajuste', description: 'Registro sem alterar esperado.' },
  { value: 'refund', label: 'Estorno', description: 'Saida por devolucao.' },
]

export function CashRegisterPage() {
  usePageTitle('Caixa')
  const cashQuery = useCashRegisterQuery()
  const registerMovement = useRegisterCashMovementMutation()
  const closeRegister = useCloseCashRegisterMutation()
  const [confirmClose, setConfirmClose] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<CashMovementType>('supply')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementLabel, setMovementLabel] = useState('')
  const [countedAmount, setCountedAmount] = useState('')
  const canManageCash = useCan('cash:manage')
  const register = cashQuery.data?.data
  const canSaveMovement = Number(movementAmount) > 0 && movementLabel.trim().length >= 2

  return (
    <PageShell>
      <SectionHeader
        title="Caixa"
        description="Resumo parcial, entradas por forma de pagamento, movimentacoes e fechamento do caixa."
        actions={
          canManageCash ? (
            <>
              <Button variant="secondary" onClick={() => setMovementOpen(true)}>
                Registrar movimento
              </Button>
              <Button onClick={() => setConfirmClose(true)}>Fechar caixa</Button>
            </>
          ) : null
        }
      />

      {!register || cashQuery.isLoading ? (
        <Skeleton className="h-[120px] rounded-[24px]" />
      ) : (
        <CashSummaryCard register={register} />
      )}

      {register ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="text-base font-semibold">Entradas por forma de pagamento</h3>
              {Object.entries(register.entriesByMethod).map(([method, value]) => (
                <div
                  key={method}
                  className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10"
                >
                  <span className="text-sm font-medium">
                    {method in paymentLabelMap
                      ? paymentLabelMap[method as keyof typeof paymentLabelMap]
                      : method}
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="text-base font-semibold">Movimentacoes do caixa</h3>
              {register.movements.map((movement) => (
                <div key={movement.id} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{movement.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {movement.userName} - {formatDateTime(movement.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono font-semibold">{formatCurrency(movement.amount)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle>Conferencia do caixa</DialogTitle>
            <DialogDescription>
              Informe o valor contado fisicamente. Se deixar vazio, o sistema usa o valor esperado.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={0}
            value={countedAmount}
            onChange={(event) => setCountedAmount(event.target.value)}
            placeholder={register ? `Esperado: ${formatCurrency(register.expectedAmount)}` : 'Valor contado'}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              Cancelar
            </Button>
            <Button
              disabled={closeRegister.isPending}
              onClick={() => {
                closeRegister.mutate(countedAmount ? Number(countedAmount) : undefined)
                setConfirmClose(false)
              }}
            >
              Confirmar fechamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle>Registrar movimento</DialogTitle>
            <DialogDescription>
              Lance sangria, suprimento, estorno ou ajuste com valor real e motivo claro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={movementType}
              onValueChange={(value) => setMovementType(value as CashMovementType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {movementTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {movementTypeOptions.find((option) => option.value === movementType)?.description}
            </p>
            <Input
              type="number"
              min={0}
              value={movementAmount}
              onChange={(event) => setMovementAmount(event.target.value)}
              placeholder="Valor"
            />
            <Input
              value={movementLabel}
              onChange={(event) => setMovementLabel(event.target.value)}
              placeholder="Motivo ou observacao"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMovementOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!canSaveMovement || registerMovement.isPending}
              onClick={() => {
                registerMovement.mutate({
                  type: movementType,
                  amount: Number(movementAmount),
                  label: movementLabel.trim(),
                })
                setMovementOpen(false)
                setMovementAmount('')
                setMovementLabel('')
              }}
            >
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
