import { useState } from 'react'

import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

export function CashRegisterPage() {
  usePageTitle('Caixa')
  const cashQuery = useCashRegisterQuery()
  const registerMovement = useRegisterCashMovementMutation()
  const closeRegister = useCloseCashRegisterMutation()
  const [confirmClose, setConfirmClose] = useState(false)
  const canManageCash = useCan('cash:manage')
  const register = cashQuery.data?.data

  return (
    <PageShell>
      <SectionHeader
        title="Caixa"
        description="Resumo parcial, entradas por forma de pagamento, movimentacoes e fechamento do caixa."
        actions={
          canManageCash ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  registerMovement.mutate({
                    type: 'supply',
                    amount: 50,
                    label: 'Suprimento rapido',
                  })
                }
              >
                Suprimento
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  registerMovement.mutate({
                    type: 'withdrawal',
                    amount: 35,
                    label: 'Retirada de seguranca',
                  })
                }
              >
                Retirada
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
                    {paymentLabelMap[method as keyof typeof paymentLabelMap]}
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

      <ConfirmActionDialog
        open={confirmClose}
        title="Fechar caixa atual"
        description="O fechamento registra o estado atual do caixa na API e bloqueia novas movimentacoes neste caixa."
        confirmLabel="Confirmar fechamento"
        onOpenChange={setConfirmClose}
        onConfirm={() => {
          closeRegister.mutate(undefined)
          setConfirmClose(false)
        }}
      />
    </PageShell>
  )
}
