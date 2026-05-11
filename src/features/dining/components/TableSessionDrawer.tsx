import { type ReactNode, useMemo, useState } from 'react'

import { Timeline } from '@/components/shared/Timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatCurrency, formatDateFull } from '@/lib/format'
import type { DiningTable, PaymentMethod, Product, TableSession, Waiter } from '@/types'

const unassignedWaiter = 'unassigned'

const paymentOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credit_card', label: 'Credito' },
  { value: 'debit_card', label: 'Debito' },
  { value: 'meal_voucher', label: 'Voucher' },
  { value: 'payment_link', label: 'Link' },
]

const sessionStatusLabelMap: Record<TableSession['status'], string> = {
  open: 'Em atendimento',
  awaiting_close: 'Aguardando fechamento',
  closed: 'Conta fechada',
}

interface TableSessionDrawerProps {
  table: DiningTable | null
  session: TableSession | null
  tables: DiningTable[]
  products: Product[]
  waiters: Waiter[]
  open: boolean
  busy?: boolean
  canManage?: boolean
  onOpenChange: (open: boolean) => void
  onOpenSession: (payload: {
    tableId: string
    guestCount: number
    waiterId?: string
    notes?: string
  }) => void
  onAddItem: (payload: {
    sessionId: string
    productId: string
    quantity: number
    notes?: string
    waiterId?: string
  }) => void
  onUpdateSession: (payload: {
    sessionId: string
    waiterId?: string | null
    guestCount?: number
    notes?: string
    status?: 'open' | 'awaiting_close'
  }) => void
  onCloseSession: (payload: {
    sessionId: string
    paymentMethod: PaymentMethod
    discount?: number
    serviceFee?: number
  }) => void
  onTransferSession: (payload: { sessionId: string; targetTableId: string }) => void
  onSplitSession: (payload: {
    sessionId: string
    itemIds: string[]
    paymentMethod: PaymentMethod
  }) => void
}

export function TableSessionDrawer({
  table,
  session,
  tables,
  products,
  waiters,
  open,
  busy = false,
  canManage = true,
  onOpenChange,
  onOpenSession,
  onAddItem,
  onUpdateSession,
  onCloseSession,
  onTransferSession,
  onSplitSession,
}: TableSessionDrawerProps) {
  const firstProductId = products[0]?.id ?? ''
  const [guestCount, setGuestCount] = useState(() => String(session?.guestCount ?? table?.guests ?? 2))
  const [draftWaiterId, setDraftWaiterId] = useState(
    () => session?.waiterId ?? table?.waiterId ?? unassignedWaiter,
  )
  const [sessionNotes, setSessionNotes] = useState(() => session?.notes ?? '')
  const [selectedProductId, setSelectedProductId] = useState(() => firstProductId)
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemNotes, setItemNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    () => session?.paymentMethod ?? 'cash',
  )
  const [discount, setDiscount] = useState(() => String(session?.discount ?? 0))
  const [serviceFee, setServiceFee] = useState(() => String(session?.serviceFee ?? 0))
  const [transferTargetId, setTransferTargetId] = useState('')
  const [splitPaymentMethod, setSplitPaymentMethod] = useState<PaymentMethod>('cash')
  const [splitItemIds, setSplitItemIds] = useState<string[]>([])
  const availableTransferTargets = useMemo(
    () =>
      tables.filter(
        (entry) =>
          entry.id !== table?.id && ['free', 'reserved', 'closed'].includes(entry.status),
      ),
    [table?.id, tables],
  )

  if (!table) {
    return null
  }

  const resolvedSelectedProductId = selectedProductId || firstProductId
  const resolvedWaiterId = draftWaiterId === unassignedWaiter ? undefined : draftWaiterId
  const canSplit = Boolean(session && splitItemIds.length && splitItemIds.length < session.items.length)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Mesa {table.code}</SheetTitle>
          <SheetDescription>
            {session
              ? `Sessao aberta em ${formatDateFull(session.openedAt)}`
              : 'Mesa sem sessao ativa no momento'}
          </SheetDescription>
        </SheetHeader>

        {session ? (
          <div className="space-y-4 overflow-y-auto pr-1 scrollbar-thin">
            <Card>
              <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm">
                <MetricBlock label="Pessoas" value={String(session.guestCount)} />
                <MetricBlock label="Status" value={sessionStatusLabelMap[session.status]} />
                <MetricBlock label="Garcom" value={session.waiterName ?? 'Sem atribuicao'} />
                <MetricBlock label="Mesa" value={session.tableCode ?? table.code} />
                <MetricBlock label="Subtotal" value={formatCurrency(session.subtotal)} />
                <MetricBlock label="Total" value={formatCurrency(session.total)} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Consumo atual</h4>
                  <span className="text-sm text-muted-foreground">
                    {session.items.length} item(ns)
                  </span>
                </div>
                {session.items.map((item) => {
                  const selected = splitItemIds.includes(item.id)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        canManage
                          ? setSplitItemIds((current) =>
                              current.includes(item.id)
                                ? current.filter((entry) => entry !== item.id)
                                : [...current, item.id],
                            )
                          : undefined
                      }
                      disabled={!canManage}
                      className={`w-full rounded-2xl px-3 py-3 text-left transition ${
                        selected ? 'bg-primary text-primary-foreground' : 'bg-white/[0.04] text-slate-100 ring-1 ring-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {item.quantity}x {item.name}
                          </p>
                          <p
                            className={`text-xs ${
                              selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            }`}
                          >
                            {item.notes || 'Toque para marcar na separacao'}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h4 className="font-semibold">Lancar consumo</h4>
                <div className="grid gap-3 md:grid-cols-[1.5fr_100px]">
                  <Field label="Produto">
                    <Select value={resolvedSelectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Qtd.">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={itemQuantity}
                      onChange={(event) => setItemQuantity(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Observacao">
                  <Input
                    placeholder="Ex.: sem picles, dividir batata"
                    value={itemNotes}
                    onChange={(event) => setItemNotes(event.target.value)}
                  />
                </Field>
                <Button
                  className="w-full"
                  disabled={!canManage || busy || !resolvedSelectedProductId}
                  onClick={() => {
                    onAddItem({
                      sessionId: session.id,
                      productId: resolvedSelectedProductId,
                      quantity: Math.max(1, Number(itemQuantity) || 1),
                      notes: itemNotes || undefined,
                      waiterId: resolvedWaiterId,
                    })
                  }}
                >
                  {busy ? 'Atualizando...' : 'Adicionar item'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h4 className="font-semibold">Garcom e andamento</h4>
                <div className="grid gap-3 md:grid-cols-[1.4fr_120px]">
                  <Field label="Garcom">
                    <Select value={draftWaiterId} onValueChange={setDraftWaiterId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um garcom" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={unassignedWaiter}>Sem atribuicao</SelectItem>
                        {waiters.map((waiter) => (
                          <SelectItem key={waiter.id} value={waiter.id}>
                            {waiter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Pessoas">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={guestCount}
                      onChange={(event) => setGuestCount(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={!canManage || busy}
                    onClick={() =>
                      onUpdateSession({
                        sessionId: session.id,
                        waiterId: resolvedWaiterId ?? null,
                        guestCount: Math.max(1, Number(guestCount) || 1),
                        notes: sessionNotes || undefined,
                      })
                    }
                  >
                    Salvar atendimento
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canManage || busy}
                    onClick={() =>
                      onUpdateSession({
                        sessionId: session.id,
                        waiterId: resolvedWaiterId ?? null,
                        guestCount: Math.max(1, Number(guestCount) || 1),
                        notes: sessionNotes || undefined,
                        status: 'awaiting_close',
                      })
                    }
                  >
                    Aguardar fechamento
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h4 className="font-semibold">Transferencia e separacao</h4>
                <div className="grid gap-3 md:grid-cols-[1.4fr_160px]">
                  <Field label="Mesa de destino">
                    <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a mesa" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTransferTargets.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            Mesa {candidate.code} · {candidate.areaName ?? candidate.areaId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!canManage || busy || !transferTargetId}
                      onClick={() =>
                        onTransferSession({
                          sessionId: session.id,
                          targetTableId: transferTargetId,
                        })
                      }
                    >
                      Transferir
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1.2fr_180px]">
                  <Field label="Pagamento da conta separada">
                    <Select
                      value={splitPaymentMethod}
                      onValueChange={(value) => setSplitPaymentMethod(value as PaymentMethod)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!canManage || busy || !canSplit}
                      onClick={() =>
                        onSplitSession({
                          sessionId: session.id,
                          itemIds: splitItemIds,
                          paymentMethod: splitPaymentMethod,
                        })
                      }
                    >
                      Separar selecionados
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Toque nos itens do consumo para marcar a conta parcial antes de separar.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h4 className="font-semibold">Fechamento</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Pagamento">
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Desconto">
                    <Input value={discount} onChange={(event) => setDiscount(event.target.value)} />
                  </Field>
                  <Field label="Taxa de servico">
                    <Input
                      value={serviceFee}
                      onChange={(event) => setServiceFee(event.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  className="w-full"
                  disabled={!canManage || busy || !session.items.length}
                  onClick={() =>
                    onCloseSession({
                      sessionId: session.id,
                      paymentMethod,
                      discount: Number(discount) || 0,
                      serviceFee: Number(serviceFee) || 0,
                    })
                  }
                >
                  Fechar conta
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h4 className="font-semibold">Linha do tempo</h4>
                {session.timeline.length ? (
                  <Timeline items={session.timeline} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    As acoes da sessao vao aparecer aqui.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-4 p-5 text-sm text-muted-foreground">
              <p>Abra uma mesa para comecar a lancar o consumo do salao.</p>
              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <Field label="Pessoas">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={guestCount}
                    onChange={(event) => setGuestCount(event.target.value)}
                  />
                </Field>
                <Field label="Garcom">
                  <Select value={draftWaiterId} onValueChange={setDraftWaiterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um garcom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={unassignedWaiter}>Sem atribuicao</SelectItem>
                      {waiters.map((waiter) => (
                        <SelectItem key={waiter.id} value={waiter.id}>
                          {waiter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Observacao da sessao">
                <Input
                  placeholder="Ex.: aniversario, reserva da casa"
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                />
              </Field>
              <Button
                onClick={() =>
                  onOpenSession({
                    tableId: table.id,
                    guestCount: Math.max(1, Number(guestCount) || 1),
                    waiterId: resolvedWaiterId,
                    notes: sessionNotes || undefined,
                  })
                }
                disabled={!canManage || busy}
              >
                {busy ? 'Abrindo...' : 'Abrir mesa'}
              </Button>
            </CardContent>
          </Card>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}
