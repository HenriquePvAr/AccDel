import { type ReactNode, useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'

import { Timeline } from '@/components/shared/Timeline'
import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'
import type {
  Category,
  DiningTable,
  OrderItemOption,
  PaymentMethod,
  Product,
  ProductOptionGroup,
  TableSession,
  Waiter,
} from '@/types'

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

type OptionSelection = {
  groupId: string
  optionId: string
  quantity: number
}

type PendingCartItem = {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
  options: OptionSelection[]
  optionLabels: string[]
}

interface TableSessionDrawerProps {
  table: DiningTable | null
  session: TableSession | null
  tables: DiningTable[]
  products: Product[]
  categories: Category[]
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
  onAddItems: (payload: {
    sessionId: string
    items: Array<{
      productId: string
      quantity: number
      notes?: string
      waiterId?: string
      options?: OptionSelection[]
    }>
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
  categories,
  waiters,
  open,
  busy = false,
  canManage = true,
  onOpenChange,
  onOpenSession,
  onAddItems,
  onUpdateSession,
  onCloseSession,
  onTransferSession,
  onSplitSession,
}: TableSessionDrawerProps) {
  const [guestCount, setGuestCount] = useState(() => String(session?.guestCount ?? table?.guests ?? 1))
  const [draftWaiterId, setDraftWaiterId] = useState(
    () => session?.waiterId ?? table?.waiterId ?? unassignedWaiter,
  )
  const [sessionNotes, setSessionNotes] = useState(() => session?.notes ?? '')
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all')
  const [itemNotes, setItemNotes] = useState('')
  const [pendingCart, setPendingCart] = useState<PendingCartItem[]>([])
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null)
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

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const search = productSearch.trim().toLowerCase()
        const matchesCategory = selectedCategoryId === 'all' || product.categoryId === selectedCategoryId
        const matchesSearch =
          !search ||
          product.name.toLowerCase().includes(search) ||
          product.description.toLowerCase().includes(search) ||
          product.tags.some((tag) => tag.toLowerCase().includes(search)) ||
          (categories.find((category) => category.id === product.categoryId)?.name.toLowerCase().includes(search) ?? false)

        return matchesCategory && matchesSearch
      }),
    [categories, productSearch, products, selectedCategoryId],
  )

  if (!table) {
    return null
  }

  const resolvedWaiterId = draftWaiterId === unassignedWaiter ? undefined : draftWaiterId
  const canSplit = Boolean(session && splitItemIds.length && splitItemIds.length < session.items.length)
  const pendingTotal = pendingCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  function getCategoryName(categoryId: string) {
    return categories.find((category) => category.id === categoryId)?.name ?? 'Categoria'
  }

  function addProduct(product: Product) {
    if ((product.optionGroups ?? []).length) {
      setConfiguringProduct(product)
      return
    }

    setPendingCart((current) => mergePendingItem(current, {
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: product.price,
      notes: itemNotes.trim() || undefined,
      options: [],
      optionLabels: [],
    }))
    setItemNotes('')
  }

  function savePendingCart() {
    if (!session) {
      return
    }

    onAddItems({
      sessionId: session.id,
      items: pendingCart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        waiterId: resolvedWaiterId,
        options: item.options.length ? item.options : undefined,
      })),
    })
    setPendingCart([])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[920px] overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle>Mesa {table.code}</SheetTitle>
          <SheetDescription>
            {session
              ? `Sessao aberta em ${formatDateFull(session.openedAt)}`
              : 'Mesa livre: inicie direto e lance itens pelo catalogo.'}
          </SheetDescription>
        </SheetHeader>

        {session ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_340px]">
            <div className="space-y-4">
              <Card>
                <CardContent className="grid grid-cols-2 gap-3 p-5 text-sm md:grid-cols-4">
                  <MetricBlock label="Pessoas" value={String(session.guestCount)} />
                  <MetricBlock label="Status" value={sessionStatusLabelMap[session.status]} />
                  <MetricBlock label="Garcom" value={session.waiterName ?? 'Sem atribuicao'} />
                  <MetricBlock label="Total" value={formatCurrency(session.total + pendingTotal)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h4 className="font-semibold">Lancar pedido na mesa</h4>
                      <p className="text-sm text-muted-foreground">
                        Busque no catalogo real do salao, grave na comanda e envie para preparo.
                      </p>
                    </div>
                    <Badge variant="success">Catalogo real</Badge>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Buscar produto, ingrediente ou categoria"
                        className="pl-9"
                      />
                    </label>
                    <Select value={selectedCategoryId} onValueChange={(value) => setSelectedCategoryId(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    value={itemNotes}
                    onChange={(event) => setItemNotes(event.target.value)}
                    placeholder="Observacao do proximo item"
                  />

                  {configuringProduct ? (
                    <ProductConfigPanel
                      product={configuringProduct}
                      onCancel={() => setConfiguringProduct(null)}
                      onAdd={(configured) => {
                        setPendingCart((current) => mergePendingItem(current, configured))
                        setConfiguringProduct(null)
                      }}
                    />
                  ) : null}

                  <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 scrollbar-thin">
                    {visibleProducts.map((product) => (
                      <ProductPickCard
                        key={product.id}
                        product={product}
                        categoryName={getCategoryName(product.categoryId)}
                        disabled={!canManage || busy}
                        onAdd={() => addProduct(product)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <CurrentConsumptionCard
                session={session}
                splitItemIds={splitItemIds}
                canManage={canManage}
                onToggleSplitItem={(itemId) =>
                  setSplitItemIds((current) =>
                    current.includes(itemId)
                      ? current.filter((entry) => entry !== itemId)
                      : [...current, itemId],
                  )
                }
              />

              <Card>
                <CardContent className="space-y-4 p-5">
                  <h4 className="font-semibold">Garcom e andamento</h4>
                  <div className="grid gap-3 md:grid-cols-[1.4fr_120px]">
                    <Field label="Garcom opcional">
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
                  <Field label="Observacao da comanda">
                    <Input
                      placeholder="Ex.: aniversario, mesa aguardando mais pessoas"
                      value={sessionNotes}
                      onChange={(event) => setSessionNotes(event.target.value)}
                    />
                  </Field>
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
                  <h4 className="font-semibold">Linha do tempo</h4>
                  {session.timeline.length ? (
                    <Timeline items={session.timeline} />
                  ) : (
                    <p className="text-sm text-muted-foreground">As acoes da sessao vao aparecer aqui.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-4">
              <PendingCartCard
                items={pendingCart}
                busy={busy}
                canManage={canManage}
                onIncrement={(itemId) =>
                  setPendingCart((current) =>
                    current.map((item) =>
                      item.id === itemId ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item,
                    ),
                  )
                }
                onDecrement={(itemId) =>
                  setPendingCart((current) =>
                    current.flatMap((item) =>
                      item.id === itemId
                        ? item.quantity > 1
                          ? [{ ...item, quantity: item.quantity - 1 }]
                          : []
                        : [item],
                    ),
                  )
                }
                onRemove={(itemId) =>
                  setPendingCart((current) => current.filter((item) => item.id !== itemId))
                }
                onSave={savePendingCart}
              />

              <Card>
                <CardContent className="space-y-4 p-5">
                  <h4 className="font-semibold">Transferencia e separacao</h4>
                  <Field label="Mesa de destino">
                    <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a mesa" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTransferTargets.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            Mesa {candidate.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {transferTargetId ? (
                    <p className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground ring-1 ring-white/10">
                      Voce esta transferindo a comanda da Mesa {table.code} para a Mesa{' '}
                      {tables.find((entry) => entry.id === transferTargetId)?.code}.
                    </p>
                  ) : null}
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
                    Transferir mesa
                  </Button>

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
                    Pagar itens selecionados
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-5">
                  <h4 className="font-semibold">Fechamento seguro</h4>
                  <div className="space-y-2 rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
                    <SummaryRow label="Subtotal" value={formatCurrency(session.subtotal)} />
                    <SummaryRow label="Desconto" value={formatCurrency(Number(discount) || 0)} />
                    <SummaryRow label="Taxa de servico" value={formatCurrency(Number(serviceFee) || 0)} />
                    <SummaryRow
                      label="Total"
                      value={formatCurrency(Math.max(0, session.subtotal - (Number(discount) || 0) + (Number(serviceFee) || 0)))}
                      strong
                    />
                  </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Desconto">
                      <Input value={discount} onChange={(event) => setDiscount(event.target.value)} />
                    </Field>
                    <Field label="Taxa">
                      <Input value={serviceFee} onChange={(event) => setServiceFee(event.target.value)} />
                    </Field>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!canManage || busy || !session.items.length || pendingCart.length > 0}
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
            </aside>
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-5 p-5 text-sm text-muted-foreground">
              <div>
                <p className="text-base font-semibold text-slate-100">Iniciar pedido nesta mesa</p>
                <p className="mt-1">
                  Pessoas e garcom sao opcionais. Voce pode abrir agora e completar depois.
                </p>
              </div>
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
                <Field label="Garcom opcional">
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
              <Field label="Observacao opcional">
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
                {busy ? 'Iniciando...' : 'Iniciar pedido nesta mesa'}
              </Button>
            </CardContent>
          </Card>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ProductPickCard({
  product,
  categoryName,
  disabled,
  onAdd,
}: {
  product: Product
  categoryName: string
  disabled: boolean
  onAdd: () => void
}) {
  const hasOptions = Boolean(product.optionGroups?.length)

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-100">{product.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        </div>
        <span className="font-mono text-sm font-semibold text-orange-200">
          {formatCurrency(product.price)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-muted-foreground">{categoryName}</span>
        <Button size="sm" disabled={disabled} onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {hasOptions ? 'Configurar' : 'Adicionar'}
        </Button>
      </div>
    </article>
  )
}

function ProductConfigPanel({
  product,
  onCancel,
  onAdd,
}: {
  product: Product
  onCancel: () => void
  onAdd: (item: PendingCartItem) => void
}) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const groups = product.optionGroups ?? []

  function toggleOption(group: ProductOptionGroup, optionId: string) {
    const option = group.options.find((entry) => entry.id === optionId)
    if (!option || !isOptionOrderable(option)) {
      setError(option ? `${option.name} esta indisponivel no catalogo.` : 'Opcao indisponivel.')
      return
    }

    setError(null)
    setSelectedOptions((current) => {
      const currentGroup = current[group.id] ?? []
      const selected = currentGroup.includes(optionId)
      const nextGroup = selected
        ? currentGroup.filter((entry) => entry !== optionId)
        : group.maxSelections <= 1
          ? [optionId]
          : currentGroup.length >= group.maxSelections
            ? currentGroup
            : [...currentGroup, optionId]

      return {
        ...current,
        [group.id]: nextGroup,
      }
    })
  }

  function buildConfiguredItem() {
    const invalidGroup = groups.find((group) => {
      const count = selectedOptions[group.id]?.length ?? 0
      return group.required && count < group.minSelections
    })

    if (invalidGroup) {
      setError(`Escolha ${invalidGroup.minSelections} opcao(oes) em ${invalidGroup.name}.`)
      return
    }

    const options: OrderItemOption[] = groups.flatMap((group) =>
      (selectedOptions[group.id] ?? []).flatMap((optionId) => {
        const option = group.options.find((entry) => entry.id === optionId)

        return option && isOptionOrderable(option)
          ? [
              {
                id: option.id,
                groupId: group.id,
                groupName: group.name,
                name: option.name,
                quantity: 1,
                price: option.priceDelta,
              },
            ]
          : []
      }),
    )
    const optionsTotal = options.reduce((sum, option) => sum + option.price, 0)

    onAdd({
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: product.price + optionsTotal,
      notes: notes.trim() || undefined,
      options: options.map((option) => ({
        groupId: option.groupId ?? '',
        optionId: option.id,
        quantity: option.quantity,
      })),
      optionLabels: options.map((option) =>
        `${option.groupName ?? 'Opcao'}: ${option.name}${option.price ? ` + ${formatCurrency(option.price)}` : ''}`,
      ),
    })
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-100">Configurar {product.name}</h5>
          <p className="text-sm text-muted-foreground">Escolha as opcoes obrigatorias antes de adicionar.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-medium text-slate-100">{group.name}</p>
              <span className="text-xs text-muted-foreground">
                {group.required ? 'Obrigatorio' : 'Opcional'} · ate {group.maxSelections}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => {
                const selected = selectedOptions[group.id]?.includes(option.id) ?? false
                const disabled = !isOptionOrderable(option)

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleOption(group, option.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm transition',
                      disabled
                        ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-slate-600'
                        : selected
                        ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-50'
                        : 'border-white/10 bg-white/[0.04] text-slate-100',
                    )}
                  >
                    <span className="font-medium">{option.name}</span>
                    {option.priceDelta ? (
                      <span className="ml-2 font-mono text-xs text-orange-200">
                        + {formatCurrency(option.priceDelta)}
                      </span>
                    ) : null}
                    {disabled ? (
                      <span className="mt-1 block text-xs text-red-200">Indisponivel</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Observacao deste item configurado"
        />
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        <Button className="w-full" onClick={buildConfiguredItem}>
          Adicionar configurado
        </Button>
      </div>
    </div>
  )
}

function isOptionOrderable(option: { active: boolean; available: boolean; soldOut: boolean }) {
  return option.active && option.available && !option.soldOut
}

function CurrentConsumptionCard({
  session,
  splitItemIds,
  canManage,
  onToggleSplitItem,
}: {
  session: TableSession
  splitItemIds: string[]
  canManage: boolean
  onToggleSplitItem: (itemId: string) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Consumo atual</h4>
          <span className="text-sm text-muted-foreground">{session.items.length} item(ns)</span>
        </div>
        {session.items.map((item) => {
          const selected = splitItemIds.includes(item.id)

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (canManage ? onToggleSplitItem(item.id) : undefined)}
              disabled={!canManage}
              className={cn(
                'w-full rounded-2xl px-3 py-3 text-left transition',
                selected ? 'bg-primary text-primary-foreground' : 'bg-white/[0.04] text-slate-100 ring-1 ring-white/10',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.quantity}x {item.name}
                  </p>
                  <p className={cn('mt-1 text-xs', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {item.createdByName ?? session.waiterName ?? 'Equipe'} lançou
                    {item.createdAt ? ` as ${formatTime(item.createdAt)}` : ''}
                  </p>
                  {item.notes ? <p className="mt-1 truncate text-xs text-amber-100">{item.notes}</p> : null}
                  {item.options.length ? (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {item.options.map((option) => option.name).join(', ')}
                    </p>
                  ) : null}
                </div>
                <span className="font-mono text-sm font-semibold">{formatCurrency(item.totalPrice)}</span>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PendingCartCard({
  items,
  busy,
  canManage,
  onIncrement,
  onDecrement,
  onRemove,
  onSave,
}: {
  items: PendingCartItem[]
  busy: boolean
  canManage: boolean
  onIncrement: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onRemove: (itemId: string) => void
  onSave: () => void
}) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  return (
    <Card className="sticky top-0">
      <CardContent className="space-y-4 p-5">
        <div>
          <h4 className="font-semibold">Itens para enviar</h4>
          <p className="text-sm text-muted-foreground">Revise antes de gravar na comanda e enviar para preparo.</p>
        </div>
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{item.name}</p>
                    {item.optionLabels.length ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.optionLabels.join(', ')}
                      </p>
                    ) : null}
                    {item.notes ? <p className="mt-1 text-xs text-amber-100">{item.notes}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-white"
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => onDecrement(item.id)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-7 text-center font-mono">{item.quantity}</span>
                    <Button size="sm" variant="outline" onClick={() => onIncrement(item.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="font-mono text-orange-200">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-sm text-muted-foreground">
            Nenhum item selecionado.
          </p>
        )}
        <SummaryRow label="Total do envio" value={formatCurrency(total)} strong />
        <Button className="w-full" disabled={!canManage || busy || !items.length} onClick={onSave}>
          {busy ? 'Enviando...' : 'Enviar itens para cozinha'}
        </Button>
      </CardContent>
    </Card>
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

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono', strong ? 'font-semibold text-orange-200' : 'text-slate-100')}>
        {value}
      </span>
    </div>
  )
}

function mergePendingItem(items: PendingCartItem[], next: PendingCartItem) {
  const compatible = items.find(
    (item) =>
      item.productId === next.productId &&
      item.notes === next.notes &&
      JSON.stringify(item.options) === JSON.stringify(next.options),
  )

  if (!compatible) {
    return [...items, next]
  }

  return items.map((item) =>
    item.id === compatible.id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item,
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
