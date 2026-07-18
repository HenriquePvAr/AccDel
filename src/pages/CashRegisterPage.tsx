import { useMemo, useState } from 'react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Badge } from '@/components/ui/badge'
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
import {
  useCashHistoryQuery,
  useCashRegisterQuery,
  useCashTerminalsQuery,
  useAdjustCashMutation,
  useCloseCashRegisterMutation,
  useOpenCashRegisterMutation,
  useSupplyCashMutation,
  useWithdrawCashMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { paymentLabelMap } from '@/lib/domain'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { CashRegisterHistoryFilters } from '@/contracts'
import type { CashMovement, CashRegister } from '@/types'

type CashDialog = 'open' | 'supply' | 'withdraw' | 'adjust' | 'close' | null

export function CashRegisterPage() {
  usePageTitle('Caixa')
  const [historyFilters, setHistoryFilters] = useState<CashRegisterHistoryFilters>({
    status: 'all',
    difference: 'all',
  })
  const cashQuery = useCashRegisterQuery()
  const terminalsQuery = useCashTerminalsQuery()
  const historyQuery = useCashHistoryQuery(historyFilters)
  const openRegister = useOpenCashRegisterMutation()
  const supplyCash = useSupplyCashMutation()
  const withdrawCash = useWithdrawCashMutation()
  const adjustCash = useAdjustCashMutation()
  const closeRegister = useCloseCashRegisterMutation()
  const canManageCash = useCan('cash:manage')
  const register = cashQuery.data?.data
  const terminals = terminalsQuery.data?.data ?? []
  const history = historyQuery.data?.data ?? []
  const [dialog, setDialog] = useState<CashDialog>(null)
  const [adjustmentMovement, setAdjustmentMovement] = useState<CashMovement | undefined>()

  return (
    <PageShell>
      <SectionHeader
        title="Caixa"
        description="Controle auditavel do dinheiro fisico: abertura, entradas, retiradas, fechamento e diferencas."
        actions={
          canManageCash ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {!register || register.status === 'closed' ? (
                <Button className="min-h-12" onClick={() => setDialog('open')}>
                  Abrir caixa
                </Button>
              ) : (
                <>
                  <Button className="min-h-12" variant="secondary" onClick={() => setDialog('supply')}>
                    Adicionar dinheiro
                  </Button>
                  <Button className="min-h-12" variant="secondary" onClick={() => setDialog('withdraw')}>
                    Retirar dinheiro
                  </Button>
                  <Button className="min-h-12" onClick={() => setDialog('close')}>
                    Fechar caixa
                  </Button>
                </>
              )}
            </div>
          ) : null
        }
      />

      {cashQuery.isLoading ? (
        <Skeleton className="h-[180px] rounded-[28px]" />
      ) : cashQuery.isError || !register || register.status === 'closed' ? (
        <ClosedState canManage={canManageCash} onOpen={() => setDialog('open')} />
      ) : (
        <OpenState register={register} />
      )}

      {register && register.status !== 'closed' ? (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <PaymentBreakdown register={register} />
          <MovementList
            movements={register.movements}
            canCorrect={canManageCash}
            onCorrect={(movement) => {
              setAdjustmentMovement(movement)
              setDialog('adjust')
            }}
          />
        </div>
      ) : null}

      <HistoryPanel
        registers={history}
        terminals={terminals}
        filters={historyFilters}
        onFiltersChange={setHistoryFilters}
      />

      <CashActionDialog
        dialog={dialog}
        register={register}
        adjustmentMovement={adjustmentMovement}
        terminals={terminals}
        busy={
          openRegister.isPending ||
          supplyCash.isPending ||
          withdrawCash.isPending ||
          adjustCash.isPending ||
          closeRegister.isPending
        }
        onOpenChange={setDialog}
        onOpen={(payload) => openRegister.mutate(payload, { onSuccess: () => setDialog(null) })}
        onSupply={(payload) => {
          if (!register) return
          supplyCash.mutate({ registerId: register.id, ...payload }, { onSuccess: () => setDialog(null) })
        }}
        onWithdraw={(payload) => {
          if (!register) return
          withdrawCash.mutate({ registerId: register.id, ...payload }, { onSuccess: () => setDialog(null) })
        }}
        onAdjust={(payload) => {
          if (!register || !adjustmentMovement) return
          adjustCash.mutate(
            { registerId: register.id, originalMovementId: adjustmentMovement.id, ...payload },
            { onSuccess: () => {
              setAdjustmentMovement(undefined)
              setDialog(null)
            } },
          )
        }}
        onClose={(payload) => {
          if (!register) return
          closeRegister.mutate({ registerId: register.id, ...payload }, { onSuccess: () => setDialog(null) })
        }}
      />
    </PageShell>
  )
}

function ClosedState({ canManage, onOpen }: { canManage: boolean; onOpen: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between md:p-7">
        <div>
          <Badge variant="warning">Caixa fechado</Badge>
          <h3 className="mt-4 text-2xl font-black text-foreground">Abra o caixa para comecar</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Abra o caixa para comecar a registrar vendas em dinheiro, dinheiro adicionado,
            retiradas e fechamento do turno.
          </p>
        </div>
        {canManage ? (
          <Button className="min-h-12 w-full sm:w-auto" onClick={onOpen}>
            Abrir caixa
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OpenState({ register }: { register: CashRegister }) {
  const cashSales = sumMovements(register.movements, ['CASH_SALE', 'sale'])
  const supplies = sumMovements(register.movements, ['CASH_SUPPLY', 'supply'])
  const withdrawals = sumMovements(register.movements, ['CASH_WITHDRAWAL', 'withdrawal'])
  const refunds = sumMovements(register.movements, ['CASH_REFUND', 'refund'])

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-5 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="success">Caixa aberto</Badge>
            <h2 className="mt-3 text-2xl font-black text-foreground md:text-3xl">
              {register.terminal?.name ?? 'Caixa principal'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Operador: {register.openedByName ?? register.operatorName} - Abertura:{' '}
              {formatDateTime(register.openedAt)}
            </p>
          </div>
          <div className="rounded-[28px] bg-emerald-500/10 p-5 ring-1 ring-emerald-300/20">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">Dinheiro esperado</p>
            <p className="mt-1 font-mono text-3xl font-black text-foreground md:text-4xl">
              {formatCurrency(register.expectedAmount)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Valor inicial" value={register.openingAmount} />
          <Metric label="Venda em dinheiro" value={cashSales} />
          <Metric label="Dinheiro adicionado" value={supplies} />
          <Metric label="Dinheiro retirado" value={withdrawals} tone="danger" />
          <Metric label="Reembolsos" value={refunds} tone="danger" />
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentBreakdown({ register }: { register: CashRegister }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold">Vendas por metodo</h3>
          <p className="text-sm text-muted-foreground">
            Apenas dinheiro altera o saldo fisico esperado.
          </p>
        </div>
        {Object.entries(register.entriesByMethod).map(([method, value]) => (
          <div
            key={method}
            className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3 ring-1 ring-border"
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
  )
}

function MovementList({
  movements,
  canCorrect,
  onCorrect,
}: {
  movements: CashMovement[]
  canCorrect: boolean
  onCorrect: (movement: CashMovement) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold">Ultimas movimentacoes</h3>
          <p className="text-sm text-muted-foreground">
            Movimentos sao imutaveis; correcao deve ser compensatoria.
          </p>
        </div>
        <div className="space-y-3">
          {movements.map((movement) => (
            <div key={movement.id} className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{movementLabel(movement)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {movement.userName} - {formatDateTime(movement.createdAt)}
                  </p>
                  {movement.reason ? (
                    <p className="mt-2 text-sm text-muted-foreground">{movement.reason}</p>
                  ) : null}
                </div>
                <span className="font-mono font-semibold">{formatCurrency(movement.amount)}</span>
              </div>
              {movement.balanceAfter !== undefined ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Saldo: {formatCurrency(movement.balanceBefore ?? 0)} {'->'}{' '}
                  {formatCurrency(movement.balanceAfter)}
                </p>
              ) : null}
              {canCorrect && movement.type !== 'CLOSING_DIFFERENCE' ? (
                <Button
                  className="mt-3 min-h-12 w-full sm:w-auto"
                  size="sm"
                  variant="ghost"
                  onClick={() => onCorrect(movement)}
                >
                  Corrigir movimento
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function HistoryPanel({
  registers,
  terminals,
  filters,
  onFiltersChange,
}: {
  registers: CashRegister[]
  terminals: Array<{ id: string; name: string }>
  filters: CashRegisterHistoryFilters
  onFiltersChange: (filters: CashRegisterHistoryFilters) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold">Historico recente</h3>
          <p className="text-sm text-muted-foreground">
            Consulte por periodo, operador, terminal, status e diferenca.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input
            className="min-h-12"
            type="date"
            aria-label="Data inicial"
            value={filters.from ?? ''}
            onChange={(event) => onFiltersChange({ ...filters, from: event.target.value || undefined })}
          />
          <Input
            className="min-h-12"
            type="date"
            aria-label="Data final"
            value={filters.to ?? ''}
            onChange={(event) => onFiltersChange({ ...filters, to: event.target.value || undefined })}
          />
          <Input
            className="min-h-12"
            aria-label="Operador"
            placeholder="Operador"
            value={filters.operator ?? ''}
            onChange={(event) => onFiltersChange({ ...filters, operator: event.target.value || undefined })}
          />
          <Select
            value={filters.terminalId ?? 'all'}
            onValueChange={(value) => onFiltersChange({ ...filters, terminalId: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Terminal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os terminais</SelectItem>
              {terminals.map((terminal) => <SelectItem key={terminal.id} value={terminal.id}>{terminal.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(value) => onFiltersChange({ ...filters, status: value as CashRegisterHistoryFilters['status'] })}
          >
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="closing">Em fechamento</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.difference ?? 'all'}
            onValueChange={(value) => onFiltersChange({ ...filters, difference: value as CashRegisterHistoryFilters['difference'] })}
          >
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Diferenca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Com ou sem diferenca</SelectItem>
              <SelectItem value="with">Com diferenca</SelectItem>
              <SelectItem value="without">Sem diferenca</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {registers.map((register) => (
            <div key={register.id} className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{register.terminal?.name ?? 'Caixa principal'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(register.openedAt)}
                    {register.closedAt ? ` - ${formatDateTime(register.closedAt)}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {register.openedByName ?? register.operatorName} - {durationLabel(register)}
                  </p>
                </div>
                <Badge variant={register.status === 'open' ? 'success' : 'default'}>
                  {register.status === 'open' ? 'Aberto' : 'Fechado'}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <MiniMetric label="Inicial" value={register.openingAmount} />
                <MiniMetric label="Esperado" value={register.expectedAmount} />
                <MiniMetric label="Contado" value={register.countedAmount} />
                <MiniMetric label="Diferenca" value={register.differenceAmount} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(register.entriesByMethod).map(([method, amount]) => (
                  <span key={method}>
                    {method in paymentLabelMap ? paymentLabelMap[method as keyof typeof paymentLabelMap] : method}: {formatCurrency(amount)}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Adicionado: {formatCurrency(sumMovements(register.movements, ['CASH_SUPPLY', 'supply']))}</span>
                <span>Retirado: {formatCurrency(sumMovements(register.movements, ['CASH_WITHDRAWAL', 'withdrawal']))}</span>
                <span>Reembolsos: {formatCurrency(sumMovements(register.movements, ['CASH_REFUND', 'refund']))}</span>
              </div>
            </div>
          ))}
        </div>
        {!registers.length ? (
          <p className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
            Nenhum caixa encontrado para os filtros informados.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CashActionDialog({
  dialog,
  register,
  adjustmentMovement,
  terminals,
  busy,
  onOpenChange,
  onOpen,
  onSupply,
  onWithdraw,
  onAdjust,
  onClose,
}: {
  dialog: CashDialog
  register?: CashRegister
  adjustmentMovement?: CashMovement
  terminals: Array<{ id: string; name: string }>
  busy: boolean
  onOpenChange: (dialog: CashDialog) => void
  onOpen: (payload: { terminalId?: string; openingAmount: number; note?: string }) => void
  onSupply: (payload: { amount: number; reason: string }) => void
  onWithdraw: (payload: { amount: number; reason: string }) => void
  onAdjust: (payload: { amount: number; direction: 'increase' | 'decrease'; reason: string }) => void
  onClose: (payload: { countedAmount: number; note?: string; differenceReason?: string }) => void
}) {
  const [terminalId, setTerminalId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase')
  const counted = Number(amount || 0)
  const closeDifference = useMemo(
    () => counted - (register?.expectedAmount ?? 0),
    [counted, register?.expectedAmount],
  )

  function reset(next: CashDialog) {
    onOpenChange(next)
    setTerminalId('')
    setAmount('')
    setReason('')
    setNote('')
    setDirection('increase')
  }

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => reset(open ? dialog : null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        {dialog === 'open' ? (
          <DialogBody
            title="Abrir caixa"
            description="Informe quanto ha em dinheiro no caixa antes de comecar."
          >
            <Select value={terminalId} onValueChange={setTerminalId}>
              <SelectTrigger className="min-h-12">
                <SelectValue placeholder="Caixa ou terminal" />
              </SelectTrigger>
              <SelectContent>
                {terminals.map((terminal) => (
                  <SelectItem key={terminal.id} value={terminal.id}>
                    {terminal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MoneyInput value={amount} onChange={setAmount} placeholder="Valor inicial" />
            <Input className="min-h-12" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observacao" />
            <ConfirmBox
              lines={[
                `Operador autenticado sera registrado pela API.`,
                `Terminal: ${terminals.find((terminal) => terminal.id === terminalId)?.name ?? 'padrao'}`,
                `Valor inicial: ${formatCurrency(Number(amount || 0))}`,
              ]}
            />
            <DialogActions
              busy={busy}
              disabled={Number(amount || 0) < 0}
              confirmLabel="Confirmar abertura"
              onCancel={() => reset(null)}
              onConfirm={() => onOpen({ terminalId: terminalId || undefined, openingAmount: Number(amount || 0), note })}
            />
          </DialogBody>
        ) : null}

        {dialog === 'supply' ? (
          <DialogBody title="Adicionar dinheiro" description="Registre dinheiro fisico colocado no caixa.">
            <MoneyInput value={amount} onChange={setAmount} placeholder="Valor" />
            <Input className="min-h-12" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatorio" />
            <DialogActions
              busy={busy}
              disabled={Number(amount) <= 0 || reason.trim().length < 2}
              confirmLabel="Adicionar dinheiro"
              onCancel={() => reset(null)}
              onConfirm={() => onSupply({ amount: Number(amount), reason: reason.trim() })}
            />
          </DialogBody>
        ) : null}

        {dialog === 'withdraw' ? (
          <DialogBody
            title="Retirar dinheiro"
            description="Registre retirada de dinheiro. Sangria e uma explicacao operacional, nao uma edicao do saldo."
          >
            <MoneyInput value={amount} onChange={setAmount} placeholder="Valor" />
            <Input className="min-h-12" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatorio" />
            <DialogActions
              busy={busy}
              disabled={Number(amount) <= 0 || Number(amount) > (register?.expectedAmount ?? 0) || reason.trim().length < 2}
              confirmLabel="Retirar dinheiro"
              onCancel={() => reset(null)}
              onConfirm={() => onWithdraw({ amount: Number(amount), reason: reason.trim() })}
            />
          </DialogBody>
        ) : null}

        {dialog === 'adjust' ? (
          <DialogBody
            title="Corrigir movimento"
            description="O movimento original sera preservado e um ajuste compensatorio sera registrado."
          >
            <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border">
              <p className="text-sm text-muted-foreground">Movimento original</p>
              <p className="font-medium">{adjustmentMovement ? movementLabel(adjustmentMovement) : '-'}</p>
              <p className="font-mono text-sm">{formatCurrency(adjustmentMovement?.amount ?? 0)}</p>
            </div>
            <Select value={direction} onValueChange={(value) => setDirection(value as 'increase' | 'decrease')}>
              <SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Aumentar saldo esperado</SelectItem>
                <SelectItem value="decrease">Reduzir saldo esperado</SelectItem>
              </SelectContent>
            </Select>
            <MoneyInput value={amount} onChange={setAmount} placeholder="Valor da correcao" />
            <Input className="min-h-12" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatorio" />
            <DialogActions
              busy={busy}
              disabled={Number(amount) <= 0 || reason.trim().length < 2}
              confirmLabel="Registrar correcao"
              onCancel={() => reset(null)}
              onConfirm={() => onAdjust({ amount: Number(amount), direction, reason: reason.trim() })}
            />
          </DialogBody>
        ) : null}

        {dialog === 'close' ? (
          <DialogBody title="Fechar caixa" description="Confira o dinheiro contado fisicamente.">
            <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border">
              <p className="text-sm text-muted-foreground">Dinheiro esperado</p>
              <p className="font-mono text-3xl font-black text-foreground">
                {formatCurrency(register?.expectedAmount ?? 0)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <MiniMetric label="Valor inicial" value={register?.openingAmount ?? 0} />
              {Object.entries(register?.entriesByMethod ?? {}).map(([method, value]) => (
                <MiniMetric
                  key={method}
                  label={method in paymentLabelMap ? paymentLabelMap[method as keyof typeof paymentLabelMap] : method}
                  value={value}
                />
              ))}
              <MiniMetric label="Adicionado" value={register ? sumMovements(register.movements, ['CASH_SUPPLY', 'supply']) : 0} />
              <MiniMetric label="Retirado" value={register ? sumMovements(register.movements, ['CASH_WITHDRAWAL', 'withdrawal']) : 0} />
              <MiniMetric label="Reembolsos" value={register ? sumMovements(register.movements, ['CASH_REFUND', 'refund']) : 0} />
            </div>
            <MoneyInput value={amount} onChange={setAmount} placeholder="Dinheiro contado" />
            <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border">
              <p className="text-sm text-muted-foreground">Diferenca</p>
              <p className="font-mono text-2xl font-black text-foreground">{formatCurrency(closeDifference)}</p>
            </div>
            <Input className="min-h-12" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observacao" />
            {closeDifference !== 0 ? (
              <Input
                className="min-h-12"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Justificativa obrigatoria da diferenca"
              />
            ) : null}
            <DialogActions
              busy={busy}
              disabled={counted < 0 || (closeDifference !== 0 && reason.trim().length < 2)}
              confirmLabel="Confirmar fechamento"
              onCancel={() => reset(null)}
              onConfirm={() =>
                onClose({
                  countedAmount: counted,
                  note: note.trim() || undefined,
                  differenceReason: reason.trim() || undefined,
                })
              }
            />
          </DialogBody>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DialogBody({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">{children}</div>
    </>
  )
}

function DialogActions({
  busy,
  disabled,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  disabled: boolean
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="sticky bottom-0 flex flex-col-reverse gap-2 bg-background/95 pt-2 sm:flex-row sm:justify-end">
      <Button className="min-h-12" variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button className="min-h-12" disabled={busy || disabled} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <Input
      className="min-h-12 text-base"
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  )
}

function ConfirmBox({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground ring-1 ring-border">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={tone === 'danger' ? 'font-mono text-lg font-bold text-destructive' : 'font-mono text-lg font-bold text-foreground'}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">{formatCurrency(value)}</p>
    </div>
  )
}

function sumMovements(registerMovements: CashMovement[], types: CashMovement['type'][]) {
  return registerMovements
    .filter((movement) => types.includes(movement.type))
    .reduce((total, movement) => total + movement.amount, 0)
}

function durationLabel(register: CashRegister) {
  const start = new Date(register.openedAt).getTime()
  const end = register.closedAt ? new Date(register.closedAt).getTime() : Date.now()
  const minutes = Math.max(0, Math.floor((end - start) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return hours ? `${hours}h ${remainingMinutes}min` : `${remainingMinutes}min`
}

function movementLabel(movement: CashMovement) {
  const labels: Partial<Record<CashMovement['type'], string>> = {
    OPENING_BALANCE: 'Valor inicial',
    CASH_SALE: 'Venda em dinheiro',
    CASH_SUPPLY: 'Dinheiro adicionado',
    CASH_WITHDRAWAL: 'Dinheiro retirado',
    CASH_REFUND: 'Reembolso',
    CASH_ADJUSTMENT: 'Ajuste',
    CLOSING_DIFFERENCE: 'Diferenca no fechamento',
    sale: 'Venda em dinheiro',
    supply: 'Dinheiro adicionado',
    withdrawal: 'Dinheiro retirado',
    refund: 'Reembolso',
    adjustment: 'Ajuste',
  }

  return labels[movement.type] ?? movement.label
}
