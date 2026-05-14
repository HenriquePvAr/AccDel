import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  Bike,
  Building2,
  ClipboardList,
  Home,
  MessageSquare,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Trash2,
  UserRound,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  useCategoriesQuery,
  useCreateOrderMutation,
  useCustomersQuery,
  useDiningTablesQuery,
  useProductsQuery,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useNewOrderStore } from '@/stores'
import type { OrderChannel, PaymentMethod, Product } from '@/types'

const channels: Array<{ value: OrderChannel; icon: typeof Bike }> = [
  { value: 'delivery', icon: Bike },
  { value: 'counter', icon: ShoppingBag },
  { value: 'dine_in', icon: Building2 },
  { value: 'pickup', icon: Package },
]
const emptyProducts: Product[] = []

const inputClass =
  'h-11 rounded-xl border-white/10 bg-[#07111f] text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:ring-orange-500/20'
const panelClass =
  'rounded-[24px] border border-white/10 bg-[#07111f]/88 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl'

export function NewOrderPage() {
  usePageTitle('Novo pedido')
  const navigate = useNavigate()
  const [
    channel,
    customerId,
    addressId,
    tableId,
    paymentMethod,
    notes,
    sendToProduction,
    cartItems,
    setChannel,
    setCustomerId,
    setAddressId,
    setTableId,
    setPaymentMethod,
    setNotes,
    setSendToProduction,
    replaceCartItems,
    addProduct,
    removeItem,
    updateQuantity,
    reset,
  ] = useNewOrderStore(
    useShallow((state) => [
      state.channel,
      state.customerId,
      state.addressId,
      state.tableId,
      state.paymentMethod,
      state.notes,
      state.sendToProduction,
      state.cartItems,
      state.setChannel,
      state.setCustomerId,
      state.setAddressId,
      state.setTableId,
      state.setPaymentMethod,
      state.setNotes,
      state.setSendToProduction,
      state.replaceCartItems,
      state.addProduct,
      state.removeItem,
      state.updateQuantity,
      state.reset,
    ]),
  )
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const categoriesQuery = useCategoriesQuery()
  const productsQuery = useProductsQuery({ search })
  const customersQuery = useCustomersQuery()
  const diningQuery = useDiningTablesQuery()
  const createOrderMutation = useCreateOrderMutation()

  const categories = categoriesQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? emptyProducts
  const customers = customersQuery.data?.data ?? []
  const tables = diningQuery.data?.data.tables ?? []

  const customer = customers.find((entry) => entry.id === customerId) ?? null
  const availableAddresses = customer?.addresses ?? []
  const filteredProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesCategory = selectedCategoryId === 'all' || product.categoryId === selectedCategoryId
    return matchesSearch && matchesCategory
  })
  const quickSuggestions = filteredProducts.slice(0, 4)
  const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const deliveryFee = channel === 'delivery' && cartItems.length ? 8 : 0
  const displayTotal = subtotal + deliveryFee
  const isLoading =
    categoriesQuery.isLoading ||
    productsQuery.isLoading ||
    customersQuery.isLoading ||
    diningQuery.isLoading

  const selectedAddress = availableAddresses.find((entry) => entry.id === addressId) ?? null
  const hasRequiredDestination =
    channel === 'delivery'
      ? Boolean(customerId && addressId)
      : channel === 'dine_in'
        ? Boolean(tableId)
        : true
  const canCreateOrder =
    cartItems.length > 0 && hasRequiredDestination && !createOrderMutation.isPending

  const handleCustomerChange = (nextCustomerId: string) => {
    setCustomerId(nextCustomerId)
    const nextCustomer = customers.find((entry) => entry.id === nextCustomerId)
    setAddressId(nextCustomer?.addresses[0]?.id ?? null)
  }

  useEffect(() => {
    if (!products.length || !cartItems.length) {
      return
    }

    const productsById = new Map(products.map((product) => [product.id, product]))
    const nextCartItems = cartItems.flatMap((item) => {
      const product = productsById.get(item.productId)

      if (!product) {
        return []
      }

      return [
        {
          ...item,
          name: product.name,
          unitPrice: product.price,
        },
      ]
    })

    const changed =
      nextCartItems.length !== cartItems.length ||
      nextCartItems.some((item, index) => {
        const current = cartItems[index]
        return !current || current.name !== item.name || current.unitPrice !== item.unitPrice
      })

    if (changed) {
      replaceCartItems(nextCartItems)
    }
  }, [cartItems, products, replaceCartItems])

  const handleCreateOrder = () => {
    if (!canCreateOrder) {
      return
    }

    createOrderMutation.mutate(
      {
        channel,
        customerId,
        addressId,
        tableId,
        paymentMethod,
        notes,
        sendToProduction,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
      {
        onSuccess: () => {
          reset()
          navigate('/orders')
        },
      },
    )
  }

  return (
    <PageShell className="min-h-[calc(100vh-72px)] space-y-5 text-slate-100">
      <div className="space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-black text-orange-500">Monte pedidos com agilidade</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Novo pedido
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Monte pedidos de forma rapida para delivery, balcao, salao ou retirada.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              className="h-12 rounded-xl border-white/10 bg-white/[0.03] px-6 text-slate-100 hover:bg-white/[0.07]"
            >
              <Trash2 className="h-4 w-4" />
              Limpar
            </Button>
            <Button
              type="button"
              disabled={!canCreateOrder}
              onClick={handleCreateOrder}
              className="h-12 rounded-xl bg-orange-600 px-7 font-black text-white shadow-[0_18px_40px_rgba(234,88,12,0.26)] hover:bg-orange-500"
            >
              <Plus className="h-4 w-4" />
              {createOrderMutation.isPending ? 'Criando...' : 'Criar pedido'}
            </Button>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.35fr_0.95fr]">
          <section className={cn(panelClass, 'p-5')}>
            <div className="mb-6 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-black text-white">1. Tipo e cliente</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-400">Canal de atendimento</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-4">
                  {channels.map((entry) => {
                    const Icon = entry.icon
                    const active = channel === entry.value

                    return (
                      <button
                        key={entry.value}
                        type="button"
                        onClick={() => setChannel(entry.value)}
                        className={cn(
                          'flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-black transition',
                          active
                            ? 'border-orange-500 bg-orange-600 text-white shadow-[0_14px_35px_rgba(234,88,12,0.26)]'
                            : 'border-white/10 bg-[#0a1421] text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-white',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {channelLabelMap[entry.value]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Cliente</label>
                <Select value={customerId ?? ''} onValueChange={handleCustomerChange}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Selecionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Telefone</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input value={customer?.phone ?? ''} readOnly className={cn(inputClass, 'pl-10')} />
                </div>
              </div>

              {channel === 'dine_in' ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Mesa</label>
                  <Select value={tableId ?? ''} onValueChange={setTableId}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Escolher mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          Mesa {table.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : channel === 'delivery' ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Endereco de entrega</label>
                  <Select value={addressId ?? ''} onValueChange={setAddressId}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Selecionar endereco" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAddresses.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.label} - {entry.district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Forma de pagamento</label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {(['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'payment_link'] as PaymentMethod[]).map((method) => (
                      <SelectItem key={method} value={method}>
                        {paymentLabelMap[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Observacoes do pedido</label>
                <div className="relative">
                  <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ex.: ponto da carne, retirar cebola..."
                    className={cn(inputClass, 'h-16 pl-10')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0a1421] px-4 py-4">
                <div>
                  <p className="font-black text-white">Enviar direto para producao</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Mantem o fluxo operacional rapido.
                  </p>
                </div>
                <Switch checked={sendToProduction} onCheckedChange={setSendToProduction} />
              </div>
            </div>
          </section>

          <section className={cn(panelClass, 'p-5')}>
            <div className="mb-5 flex items-center gap-3">
              <Package className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-black text-white">2. Itens do pedido</h2>
            </div>

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar item do cardapio"
                className={cn(inputClass, 'h-12 pl-11')}
              />
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={cn(
                  'shrink-0 rounded-xl border px-4 py-2 text-sm font-black transition',
                  selectedCategoryId === 'all'
                    ? 'border-orange-500 bg-orange-600 text-white'
                    : 'border-white/10 bg-[#0a1421] text-slate-300 hover:border-orange-500/40 hover:text-white',
                )}
              >
                Todos
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={cn(
                    'shrink-0 rounded-xl border px-4 py-2 text-sm font-black transition',
                    selectedCategoryId === category.id
                      ? 'border-orange-500 bg-orange-600 text-white'
                      : 'border-white/10 bg-[#0a1421] text-slate-300 hover:border-orange-500/40 hover:text-white',
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-2xl bg-white/10" />
                <Skeleton className="h-20 rounded-2xl bg-white/10" />
                <Skeleton className="h-20 rounded-2xl bg-white/10" />
              </div>
            ) : filteredProducts.length ? (
              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#091421]">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="grid gap-3 border-b border-white/10 p-3 last:border-b-0 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
                  >
                    <img
                      src={product.image}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-white">{product.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{product.description}</p>
                    </div>
                    <p className="font-mono font-black text-white">{formatCurrency(product.price)}</p>
                    <Button
                      type="button"
                      onClick={() => addProduct(product.id, product.name, product.price)}
                      className="h-10 rounded-xl bg-orange-600 px-4 font-black text-white hover:bg-orange-500"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ShoppingBasket className="h-5 w-5" />}
                title="Catalogo indisponivel"
                description="Nenhum produto apareceu na consulta atual."
              />
            )}

            {quickSuggestions.length ? (
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="mb-3 text-sm font-black text-white">Sugestoes rapidas</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {quickSuggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product.id, product.name, product.price)}
                      className="rounded-2xl border border-white/10 bg-[#0a1421] p-3 text-left transition hover:border-orange-500/40 hover:bg-orange-500/10"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={product.image}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10"
                        />
                        <p className="truncate text-xs font-black text-white">{product.name}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-400">{formatCurrency(product.price)}</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/60 text-orange-300">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className={cn(panelClass, 'p-5')}>
            <div className="mb-5 flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-black text-white">Resumo do pedido</h2>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-[#0a1421] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-300">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{customer?.name ?? 'Cliente nao selecionado'}</p>
                  <p className="truncate text-sm text-slate-400">
                    {selectedAddress
                      ? `${selectedAddress.label} - ${selectedAddress.district}`
                      : channelLabelMap[channel]}
                  </p>
                  {channel === 'delivery' ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <Bike className="h-3.5 w-3.5" />
                      Entrega em 25-35 min
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#091421]">
              {cartItems.length ? (
                cartItems.map((item) => (
                  <div key={item.id} className="grid gap-3 border-b border-white/10 p-3 last:border-b-0 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{item.name}</p>
                      <p className="mt-1 font-mono text-sm text-slate-400">{formatCurrency(item.unitPrice)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <div className="flex items-center overflow-hidden rounded-xl border border-white/10">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="flex h-9 w-9 items-center justify-center text-sm font-black text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-orange-500 hover:bg-orange-500/10"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remover ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                  Adicione itens para montar o carrinho.
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Adicionar observacao geral..."
                  className={cn(inputClass, 'pl-10')}
                />
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal</span>
                <span className="font-mono font-bold text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Taxa de entrega</span>
                <span className="font-mono font-bold text-white">{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-emerald-300">
                <span>Desconto</span>
                <span className="font-mono font-bold">- {formatCurrency(0)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a1421] p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-black text-white">Total do pedido</p>
                <p className="font-mono text-3xl font-black text-white">{formatCurrency(displayTotal)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-slate-400">
                Rascunho salvo automaticamente neste navegador.
              </p>
              <Button
                type="button"
                disabled={!canCreateOrder}
                onClick={handleCreateOrder}
                className="h-12 rounded-xl bg-orange-600 font-black text-white hover:bg-orange-500"
              >
                <Home className="h-4 w-4" />
                {createOrderMutation.isPending ? 'Criando...' : 'Criar e abrir no kanban'}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  )
}
