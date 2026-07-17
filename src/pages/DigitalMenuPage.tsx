import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCatalogMenuSourceQuery, useCreatePublicOrderMutation } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  CatalogMenuProduct,
  CatalogMenuSource,
  Order,
  OrderItemOption,
  ProductOptionGroup,
  PublicCheckoutPaymentMethod,
} from '@/types'

interface DigitalCartItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  notes: string
  options: OrderItemOption[]
}

interface DigitalCustomerDraft {
  name: string
  phone: string
  address: string
  neighborhood: string
  complement: string
  reference: string
  notes: string
}

type DigitalOrderMode = 'delivery' | 'pickup'

interface PrefillResult {
  cartItems: DigitalCartItem[]
  customer: Partial<DigitalCustomerDraft>
  orderMode?: DigitalOrderMode
  droppedItems: number
}

const emptyCustomer: DigitalCustomerDraft = {
  name: '',
  phone: '',
  address: '',
  neighborhood: '',
  complement: '',
  reference: '',
  notes: '',
}

export function DigitalMenuPage() {
  usePageTitle('Cardapio digital')
  const menuQuery = useCatalogMenuSourceQuery({
    channel: 'digital_menu',
    includeUnavailable: true,
    public: true,
  })
  const createPublicOrder = useCreatePublicOrderMutation()
  const source = menuQuery.data?.data
  const categories = source?.categories ?? []
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [configuringProduct, setConfiguringProduct] = useState<CatalogMenuProduct | null>(null)
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [cartItems, setCartItems] = useState<DigitalCartItem[]>([])
  const [customer, setCustomer] = useState<DigitalCustomerDraft>(emptyCustomer)
  const [orderMode, setOrderMode] = useState<DigitalOrderMode>('delivery')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)
  const [publicTrackingUrl, setPublicTrackingUrl] = useState('')
  const [prefillWarning, setPrefillWarning] = useState<string | null>(null)
  const whatsappNumber = source?.store.publicWhatsapp?.replace(/\D/g, '') ?? ''
  const effectiveOrderMode = resolveEffectiveOrderMode(orderMode, source?.checkout.channels ?? null)
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null
  const products = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const rows = selectedCategory?.products ?? []

    return rows.filter((product) =>
      normalized
        ? `${product.name} ${product.description} ${product.tags.join(' ')}`
            .toLowerCase()
            .includes(normalized)
        : true,
    )
  }, [search, selectedCategory?.products])
  const paymentMethods = useMemo(
    () => source?.checkout.paymentMethods ?? [],
    [source?.checkout.paymentMethods],
  )
  const availablePaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.availableForCheckout),
    [paymentMethods],
  )
  const effectivePaymentMethodId = paymentMethodId || availablePaymentMethods[0]?.id || ''
  const selectedPaymentMethod =
    paymentMethods.find((method) => method.id === effectivePaymentMethodId) ?? null
  const prefill = useMemo(() => (source ? readPrefillFromUrl(source) : null), [source])
  const selectedNeighborhood = useMemo(() => {
    const delivery = source?.checkout.delivery
    const normalized = normalizeText(customer.neighborhood)

    if (!delivery || !normalized) {
      return null
    }

    return (
      delivery.neighborhoods.find(
        (zone) => normalizeText(zone.neighborhood) === normalized,
      ) ?? null
    )
  }, [customer.neighborhood, source?.checkout.delivery])
  const deliveryFee =
    effectiveOrderMode === 'delivery'
      ? selectedNeighborhood?.fee ??
        (source?.checkout.delivery.requiresKnownNeighborhood
          ? 0
          : source?.checkout.delivery.defaultFee ?? 0)
      : 0
  const deliveryEtaMinutes =
    effectiveOrderMode === 'delivery'
      ? selectedNeighborhood?.estimatedDeliveryTimeMinutes ??
        source?.store.estimatedDeliveryTimeMinutes
      : source?.store.estimatedPickupTimeMinutes
  const subtotal = cartItems.reduce(
    (sum, item) => sum + (item.unitPrice + getOptionsTotal(item.options)) * item.quantity,
    0,
  )
  const total = subtotal + deliveryFee
  const checkoutProblem = getCheckoutProblem({
    cartItems,
    customer,
    orderMode: effectiveOrderMode,
    selectedPaymentMethod,
    checkoutChannels: source?.checkout.channels ?? null,
    subtotal,
    deliveryRequiresKnownNeighborhood: Boolean(source?.checkout.delivery.requiresKnownNeighborhood),
    selectedNeighborhoodFound: Boolean(selectedNeighborhood),
  })
  const whatsappFollowUrl =
    whatsappNumber && createdOrder
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
          `Ola, acabei de fazer o pedido ${createdOrder.number} pelo cardapio digital.`,
        )}`
      : ''

  function openConfigurator(product: CatalogMenuProduct) {
    if (!product.orderable) {
      return
    }

    setConfiguringProduct(product)
    setSelections(Object.fromEntries(product.optionGroups.map((group) => [group.id, []])))
  }

  function addToCart(product: CatalogMenuProduct) {
    const options = buildSelectedOptions(product, selections)
    setCartItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        notes: '',
        options,
      },
    ])
    setConfiguringProduct(null)
    setSelections({})
  }

  function updateCartQuantity(itemId: string, quantity: number) {
    setCartItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    )
  }

  function updateCartNotes(itemId: string, notes: string) {
    setCartItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, notes } : item)),
    )
  }

  function updateCustomer(field: keyof DigitalCustomerDraft, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }))
  }

  async function submitOrder() {
    if (checkoutProblem || !selectedPaymentMethod?.availableForCheckout) {
      return
    }

    const response = await createPublicOrder.mutateAsync({
      customerName: customer.name.trim(),
      customerPhone: customer.phone.trim(),
      address: effectiveOrderMode === 'delivery' ? customer.address.trim() : undefined,
      neighborhood: effectiveOrderMode === 'delivery' ? customer.neighborhood.trim() : undefined,
      complement: customer.complement.trim() || undefined,
      reference: customer.reference.trim() || undefined,
      notes: customer.notes.trim() || undefined,
      orderMode: effectiveOrderMode,
      paymentMethodId: selectedPaymentMethod.id,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes.trim() || undefined,
        selectedOptions: item.options.map((option) => ({
          groupId: option.groupId ?? '',
          optionId: option.id,
          quantity: option.quantity,
        })),
      })),
    })

    setCreatedOrder(response.data)
    setPublicTrackingUrl(response.tracking?.url ?? '')
  }

  function resetOrder() {
    setCreatedOrder(null)
    setPublicTrackingUrl('')
    setCartItems([])
    setCustomer(emptyCustomer)
    setOrderMode('delivery')
    setPrefillWarning(null)
  }

  function applyPrefill(nextPrefill: PrefillResult) {
    if (nextPrefill.cartItems.length) {
      setCartItems(nextPrefill.cartItems)
    }

    if (nextPrefill.orderMode) {
      setOrderMode(nextPrefill.orderMode)
    }

    if (Object.keys(nextPrefill.customer).length) {
      setCustomer((current) => ({ ...current, ...nextPrefill.customer }))
    }

    setPrefillWarning(
      nextPrefill.droppedItems
        ? `${nextPrefill.droppedItems} item(ns) do rascunho nao entraram porque nao existem ou nao estao disponiveis no cardapio digital.`
        : null,
    )
  }

  if (createdOrder) {
    return (
      <DigitalOrderSuccess
        order={createdOrder}
        trackingUrl={publicTrackingUrl}
        whatsappFollowUrl={whatsappFollowUrl}
        onNewOrder={resetOrder}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[#06101d] text-slate-100">
      <header className="border-b border-white/10 bg-[#050b14]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                <Store className="h-4 w-4" />
                {source?.store.tradeName ?? 'Cain Delivery'}
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-white sm:text-4xl">
                Cardapio digital
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                <span className="flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                  <Clock3 className="h-3.5 w-3.5" />
                  {deliveryEtaMinutes ?? source?.store.estimatedDeliveryTimeMinutes ?? 90} min
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  Pedido direto no Cain Delivery
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:text-right">
              <p className="text-xs text-slate-500">Total da sacola</p>
              <p className="font-mono text-2xl font-black text-orange-300">
                {formatCurrency(total)}
              </p>
              <p className="text-xs text-slate-500">
                {cartItems.reduce((sum, item) => sum + item.quantity, 0)} item(ns)
              </p>
            </div>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto ou ingrediente"
              className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-11 text-white"
            />
          </label>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div className="min-w-0 space-y-5">
          {prefillWarning ? (
            <HonestNotice
              tone="warning"
              title="Rascunho parcialmente carregado"
              description={prefillWarning}
            />
          ) : null}
          {source?.checkout.channels.digitalMenuEnabled === false ? (
            <HonestNotice
              tone="warning"
              title="Cardapio digital pausado"
              description="A loja deixou o canal digital desativado. O catalogo continua visivel, mas o checkout esta bloqueado."
            />
          ) : null}
          {prefill && !cartItems.length ? (
            <PrefillNotice prefill={prefill} onApply={() => applyPrefill(prefill)} />
          ) : null}

          {menuQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : menuQuery.isError ? (
            <EmptyState
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Cardapio indisponivel"
              description="Nao foi possivel carregar o catalogo publico da API."
            />
          ) : categories.length ? (
            <>
              <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Categorias">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                      selectedCategory?.id === category.id
                        ? 'border-orange-300/60 bg-orange-500 text-white'
                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20',
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <DigitalProductCard
                    key={product.id}
                    product={product}
                    onChoose={() => openConfigurator(product)}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Cardapio indisponivel"
              description="Nenhuma categoria vendavel foi retornada pela API do catalogo."
            />
          )}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-white/10 bg-[#0b1828] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] lg:sticky lg:top-4">
          <CartPanel
            cartItems={cartItems}
            onRemove={(itemId) =>
              setCartItems((current) => current.filter((entry) => entry.id !== itemId))
            }
            onQuantityChange={updateCartQuantity}
            onNotesChange={updateCartNotes}
          />

          <CheckoutForm
            source={source}
            customer={customer}
            orderMode={effectiveOrderMode}
            paymentMethods={paymentMethods}
            selectedPaymentMethodId={effectivePaymentMethodId}
            deliveryFee={deliveryFee}
            subtotal={subtotal}
            total={total}
            selectedNeighborhoodFound={Boolean(selectedNeighborhood)}
            onCustomerChange={updateCustomer}
            onOrderModeChange={setOrderMode}
            onPaymentMethodChange={setPaymentMethodId}
          />

          {createPublicOrder.error instanceof Error ? (
            <HonestNotice
              tone="danger"
              title="Pedido nao criado"
              description={createPublicOrder.error.message}
            />
          ) : null}

          {checkoutProblem ? (
            <p className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
              {checkoutProblem}
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={Boolean(checkoutProblem) || createPublicOrder.isPending}
            onClick={() => void submitOrder()}
          >
            <PackageCheck className="h-4 w-4" />
            {createPublicOrder.isPending ? 'Finalizando...' : 'Finalizar pedido'}
          </Button>

          <p className="text-xs leading-5 text-slate-500">
            O pedido e revalidado no backend antes de entrar na operacao. Produto, opcao,
            disponibilidade, taxa e pagamento passam pelo banco real.
          </p>
        </aside>
      </section>

      {configuringProduct ? (
        <DigitalProductConfigurator
          product={configuringProduct}
          selections={selections}
          onSelectionsChange={setSelections}
          onCancel={() => setConfiguringProduct(null)}
          onAdd={() => addToCart(configuringProduct)}
        />
      ) : null}
    </main>
  )
}

function DigitalProductCard({
  product,
  onChoose,
}: {
  product: CatalogMenuProduct
  onChoose: () => void
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1828]">
      <div className="relative aspect-[16/10] bg-black/20">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        {!product.orderable ? (
          <span className="absolute left-3 top-3 rounded-full border border-red-300/30 bg-red-500/15 px-3 py-1 text-xs font-black text-red-100">
            Indisponivel
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-1 font-black text-white">{product.name}</h2>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-400">
            {product.description}
          </p>
        </div>
        {product.optionGroups.length ? (
          <div className="flex flex-wrap gap-1.5">
            {product.optionGroups.flatMap((group) =>
              group.options.slice(0, 4).map((option) => (
                <span
                  key={`${group.id}-${option.id}`}
                  className={cn(
                    'rounded-full border px-2 py-1 text-[11px]',
                    option.orderable !== false
                      ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
                      : 'border-red-300/20 bg-red-400/10 text-red-100',
                  )}
                >
                  {option.name}
                </span>
              )),
            )}
          </div>
        ) : null}
        {product.unavailableReason ? (
          <p className="text-xs leading-5 text-red-200">{product.unavailableReason}</p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-lg font-black text-orange-300">
            {formatCurrency(product.price)}
          </p>
          <Button size="sm" disabled={!product.orderable} onClick={onChoose}>
            <Plus className="h-4 w-4" />
            Escolher
          </Button>
        </div>
      </div>
    </article>
  )
}

function CartPanel({
  cartItems,
  onRemove,
  onQuantityChange,
  onNotesChange,
}: {
  cartItems: DigitalCartItem[]
  onRemove: (itemId: string) => void
  onQuantityChange: (itemId: string, quantity: number) => void
  onNotesChange: (itemId: string, notes: string) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-5 w-5 text-orange-300" />
        <h2 className="font-black text-white">Sacola</h2>
      </div>
      <div className="space-y-2">
        {cartItems.length ? (
          cartItems.map((item) => (
            <div key={item.id} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{item.name}</span>
                <button
                  type="button"
                  className="text-slate-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remover ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {item.options.length ? (
                <p className="mt-1 text-xs text-slate-500">
                  {item.options.map((option) => option.name).join(', ')}
                </p>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center rounded-full border border-white/10 bg-[#050c16]">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                    aria-label={`Diminuir quantidade de ${item.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono text-xs text-white">{item.quantity}</span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                    aria-label={`Aumentar quantidade de ${item.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="font-mono text-xs text-orange-200">
                  {formatCurrency((item.unitPrice + getOptionsTotal(item.options)) * item.quantity)}
                </span>
              </div>
              <textarea
                value={item.notes}
                onChange={(event) => onNotesChange(item.id, event.target.value)}
                placeholder="Observacao do item"
                className="mt-2 min-h-14 w-full resize-none rounded-xl border border-white/10 bg-[#050c16] px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
              />
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-sm text-slate-500">
            Escolha itens do cardapio real para montar sua sacola.
          </p>
        )}
      </div>
    </section>
  )
}

function CheckoutForm({
  source,
  customer,
  orderMode,
  paymentMethods,
  selectedPaymentMethodId,
  deliveryFee,
  subtotal,
  total,
  selectedNeighborhoodFound,
  onCustomerChange,
  onOrderModeChange,
  onPaymentMethodChange,
}: {
  source?: CatalogMenuSource
  customer: DigitalCustomerDraft
  orderMode: DigitalOrderMode
  paymentMethods: PublicCheckoutPaymentMethod[]
  selectedPaymentMethodId: string
  deliveryFee: number
  subtotal: number
  total: number
  selectedNeighborhoodFound: boolean
  onCustomerChange: (field: keyof DigitalCustomerDraft, value: string) => void
  onOrderModeChange: (value: DigitalOrderMode) => void
  onPaymentMethodChange: (value: string) => void
}) {
  const delivery = source?.checkout.delivery
  const channels = source?.checkout.channels
  const neighborhoodMissing =
    orderMode === 'delivery' &&
    Boolean(customer.neighborhood.trim()) &&
    Boolean(delivery?.requiresKnownNeighborhood) &&
    !selectedNeighborhoodFound

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-cyan-200" />
        <h2 className="text-sm font-black text-white">Checkout</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={channels?.deliveryEnabled === false}
          onClick={() => onOrderModeChange('delivery')}
          className={cn(
            'rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
            channels?.deliveryEnabled === false
              ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-slate-600'
              : '',
            orderMode === 'delivery'
              ? 'border-orange-300/50 bg-orange-500/15 text-white'
              : 'border-white/10 bg-[#050c16] text-slate-400 hover:text-white',
          )}
        >
          <Truck className="mb-2 h-4 w-4" />
          Delivery
        </button>
        <button
          type="button"
          disabled={channels?.pickupEnabled === false}
          onClick={() => onOrderModeChange('pickup')}
          className={cn(
            'rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
            channels?.pickupEnabled === false
              ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-slate-600'
              : '',
            orderMode === 'pickup'
              ? 'border-orange-300/50 bg-orange-500/15 text-white'
              : 'border-white/10 bg-[#050c16] text-slate-400 hover:text-white',
          )}
        >
          <Store className="mb-2 h-4 w-4" />
          Retirada
        </button>
      </div>

      <div className="grid gap-2">
        <Input
          value={customer.name}
          onChange={(event) => onCustomerChange('name', event.target.value)}
          placeholder="Nome do cliente"
          className="border-white/10 bg-[#050c16]"
        />
        <Input
          value={customer.phone}
          onChange={(event) => onCustomerChange('phone', event.target.value)}
          placeholder="WhatsApp para contato"
          inputMode="tel"
          className="border-white/10 bg-[#050c16]"
        />
        {orderMode === 'delivery' ? (
          <>
            <label className="relative block">
              <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-600" />
              <textarea
                value={customer.address}
                onChange={(event) => onCustomerChange('address', event.target.value)}
                placeholder="Endereco com numero"
                className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-[#050c16] px-3 py-2 pl-9 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
              />
            </label>
            {delivery?.neighborhoods.length ? (
              <select
                value={customer.neighborhood}
                onChange={(event) => onCustomerChange('neighborhood', event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-[#050c16] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
              >
                <option value="">Escolha o bairro</option>
                {delivery.neighborhoods.map((zone) => (
                  <option key={zone.id} value={zone.neighborhood}>
                    {zone.neighborhood} - {formatCurrency(zone.fee)}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={customer.neighborhood}
                onChange={(event) => onCustomerChange('neighborhood', event.target.value)}
                placeholder="Bairro"
                className="border-white/10 bg-[#050c16]"
              />
            )}
            {neighborhoodMissing ? (
              <p className="text-xs leading-5 text-red-200">
                Bairro nao atendido pelo checkout digital. Chame a loja no WhatsApp para confirmar.
              </p>
            ) : null}
            <Input
              value={customer.complement}
              onChange={(event) => onCustomerChange('complement', event.target.value)}
              placeholder="Complemento"
              className="border-white/10 bg-[#050c16]"
            />
            <Input
              value={customer.reference}
              onChange={(event) => onCustomerChange('reference', event.target.value)}
              placeholder="Referencia"
              className="border-white/10 bg-[#050c16]"
            />
          </>
        ) : null}
        <textarea
          value={customer.notes}
          onChange={(event) => onCustomerChange('notes', event.target.value)}
          placeholder="Observacao geral"
          className="min-h-16 w-full resize-none rounded-xl border border-white/10 bg-[#050c16] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <CreditCard className="h-4 w-4 text-cyan-200" />
          Forma de pagamento
        </div>
        {paymentMethods.length ? (
          <>
            <select
              value={selectedPaymentMethodId}
              onChange={(event) => onPaymentMethodChange(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#050c16] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
            >
              <option value="">Escolha como pagar</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id} disabled={!method.availableForCheckout}>
                  {method.name}
                  {method.availableForCheckout ? '' : ' - nao configurado'}
                </option>
              ))}
            </select>
            {paymentMethods
              .filter((method) => method.unavailableReason)
              .map((method) => (
                <p key={method.id} className="text-xs leading-5 text-slate-500">
                  {method.name}: {method.unavailableReason}
                </p>
              ))}
          </>
        ) : (
          <p className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
            Nenhuma forma de pagamento ativa para o cardapio digital.
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3 text-sm">
        <PriceRow label="Itens" value={subtotal} />
        {channels && channels.minimumOrderAmount > 0 ? (
          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Pedido minimo</span>
            <span>{formatCurrency(channels.minimumOrderAmount)}</span>
          </div>
        ) : null}
        <PriceRow label="Taxa de entrega" value={deliveryFee} muted={orderMode !== 'delivery'} />
        <div className="flex items-center justify-between gap-3 pt-2 font-black text-white">
          <span>Total</span>
          <span className="font-mono text-orange-300">{formatCurrency(total)}</span>
        </div>
      </div>
    </section>
  )
}

function DigitalProductConfigurator({
  product,
  selections,
  onSelectionsChange,
  onCancel,
  onAdd,
}: {
  product: CatalogMenuProduct
  selections: Record<string, string[]>
  onSelectionsChange: (value: Record<string, string[]>) => void
  onCancel: () => void
  onAdd: () => void
}) {
  const options = buildSelectedOptions(product, selections)
  const valid = product.optionGroups.every((group) => {
    const count = selections[group.id]?.length ?? 0
    return count >= group.minSelections && count <= group.maxSelections
  })

  function toggleOption(group: ProductOptionGroup, optionId: string) {
    const option = group.options.find((entry) => entry.id === optionId)
    if (!option || option.orderable === false || !option.active || !option.available || option.soldOut) {
      return
    }

    const current = selections[group.id] ?? []
    const selected = current.includes(optionId)
    const next = selected
      ? current.filter((entry) => entry !== optionId)
      : group.maxSelections <= 1
        ? [optionId]
        : current.length >= group.maxSelections
          ? current
          : [...current, optionId]

    onSelectionsChange({
      ...selections,
      [group.id]: next,
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid bg-black/70 p-3 backdrop-blur-sm sm:place-items-center">
      <section className="max-h-[calc(100vh-24px)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#07111f] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              Configurar item
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">{product.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{product.description}</p>
          </div>
          <Button variant="ghost" onClick={onCancel}>Fechar</Button>
        </div>

        <div className="mt-5 space-y-4">
          {product.optionGroups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{group.name}</h3>
                  <p className="text-xs text-slate-500">
                    {group.required ? 'Obrigatorio' : 'Opcional'} - min {group.minSelections} - max {group.maxSelections}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.options.map((option) => {
                  const disabled = option.orderable === false || !option.active || !option.available || option.soldOut
                  const selected = selections[group.id]?.includes(option.id) ?? false

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleOption(group, option.id)}
                      className={cn(
                        'grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                        disabled
                          ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-slate-600'
                          : selected
                            ? 'border-cyan-300/60 bg-cyan-400/12 text-white'
                            : 'border-white/10 bg-[#06111f] text-slate-300 hover:border-white/20',
                      )}
                    >
                      <span>
                        <span className="block font-black">{option.name}</span>
                        {option.description ? (
                          <span className="line-clamp-2 text-xs text-slate-500">{option.description}</span>
                        ) : null}
                        {disabled ? <span className="text-xs text-red-200">Indisponivel</span> : null}
                      </span>
                      <span className="text-right">
                        {option.priceDelta > 0 ? (
                          <span className="font-mono text-xs text-orange-300">
                            +{formatCurrency(option.priceDelta)}
                          </span>
                        ) : null}
                        {selected ? <Check className="ml-auto mt-1 h-4 w-4 text-cyan-200" /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            <p className="text-sm text-slate-500">Total do item</p>
            <p className="font-mono text-2xl font-black text-orange-300">
              {formatCurrency(product.price + getOptionsTotal(options))}
            </p>
          </div>
          <Button disabled={!valid} onClick={onAdd}>
            Adicionar
          </Button>
        </div>
      </section>
    </div>
  )
}

function DigitalOrderSuccess({
  order,
  trackingUrl,
  whatsappFollowUrl,
  onNewOrder,
}: {
  order: Order
  trackingUrl: string
  whatsappFollowUrl: string
  onNewOrder: () => void
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#06101d] px-4 py-8 text-slate-100">
      <section className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b1828] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
            <PackageCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              Pedido criado
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">{order.number}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Seu pedido entrou no Cain Delivery e ja foi enviado para a operacao da loja.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SuccessMetric label="Total" value={formatCurrency(order.total)} />
          <SuccessMetric label="Previsao" value={`${order.estimatedTotalTimeMinutes ?? 0} min`} />
          <SuccessMetric label="Pagamento" value="Na entrega/retirada" />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h2 className="font-black text-white">Resumo</h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <span>
                  {item.quantity}x {item.name}
                  {item.options.length ? (
                    <span className="block text-xs text-slate-500">
                      {item.options.map((option) => option.name).join(', ')}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-orange-200">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {whatsappFollowUrl ? (
            <Button asChild>
              <a href={whatsappFollowUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                Acompanhar pelo WhatsApp
              </a>
            </Button>
          ) : (
            <Button disabled variant="secondary">
              <MessageCircle className="h-4 w-4" />
              WhatsApp nao configurado
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onNewOrder}>
            Fazer novo pedido
          </Button>
        </div>
        {trackingUrl ? (
          <p className="mt-4 break-all text-xs leading-5 text-slate-500">
            Acompanhe por este link temporario: {trackingUrl}
          </p>
        ) : null}
      </section>
    </main>
  )
}

function SuccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-white">{value}</p>
    </div>
  )
}

function PriceRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', muted ? 'text-slate-600' : 'text-slate-400')}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  )
}

function HonestNotice({
  tone,
  title,
  description,
}: {
  tone: 'warning' | 'danger'
  title: string
  description: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm leading-6',
        tone === 'danger'
          ? 'border-red-300/20 bg-red-400/10 text-red-100'
          : 'border-amber-300/20 bg-amber-400/10 text-amber-100',
      )}
      role="alert"
    >
      <p className="font-black text-white">{title}</p>
      <p className="text-xs leading-5 opacity-90">{description}</p>
    </div>
  )
}

function PrefillNotice({
  prefill,
  onApply,
}: {
  prefill: PrefillResult
  onApply: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-black text-white">Rascunho de pedido encontrado</p>
        <p className="text-xs leading-5 text-cyan-100/80">
          {prefill.cartItems.length} item(ns) podem ser carregados no carrinho para revisao.
        </p>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={onApply}>
        Carregar rascunho
      </Button>
    </div>
  )
}

function buildSelectedOptions(
  product: CatalogMenuProduct,
  selections: Record<string, string[]>,
): OrderItemOption[] {
  return product.optionGroups.flatMap((group) =>
    (selections[group.id] ?? []).flatMap((optionId) => {
      const option = group.options.find((entry) => entry.id === optionId)

      return option
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
}

function getOptionsTotal(options: OrderItemOption[]) {
  return options.reduce((sum, option) => sum + option.price * option.quantity, 0)
}

function resolveEffectiveOrderMode(
  orderMode: DigitalOrderMode,
  checkoutChannels: CatalogMenuSource['checkout']['channels'] | null,
): DigitalOrderMode {
  if (!checkoutChannels) {
    return orderMode
  }

  if (orderMode === 'delivery' && !checkoutChannels.deliveryEnabled && checkoutChannels.pickupEnabled) {
    return 'pickup'
  }

  if (orderMode === 'pickup' && !checkoutChannels.pickupEnabled && checkoutChannels.deliveryEnabled) {
    return 'delivery'
  }

  return orderMode
}

function getCheckoutProblem({
  cartItems,
  customer,
  orderMode,
  selectedPaymentMethod,
  checkoutChannels,
  subtotal,
  deliveryRequiresKnownNeighborhood,
  selectedNeighborhoodFound,
}: {
  cartItems: DigitalCartItem[]
  customer: DigitalCustomerDraft
  orderMode: DigitalOrderMode
  selectedPaymentMethod: PublicCheckoutPaymentMethod | null
  checkoutChannels: CatalogMenuSource['checkout']['channels'] | null
  subtotal: number
  deliveryRequiresKnownNeighborhood: boolean
  selectedNeighborhoodFound: boolean
}) {
  if (checkoutChannels?.digitalMenuEnabled === false) {
    return 'Cardapio digital desativado para novos pedidos.'
  }

  if (!cartItems.length) {
    return 'Escolha pelo menos um item do cardapio.'
  }

  if (
    checkoutChannels &&
    checkoutChannels.minimumOrderAmount > 0 &&
    subtotal < checkoutChannels.minimumOrderAmount
  ) {
    return `Pedido minimo de ${formatCurrency(checkoutChannels.minimumOrderAmount)} nao atingido.`
  }

  if (customer.name.trim().length < 2) {
    return 'Informe o nome do cliente.'
  }

  if (customer.phone.replace(/\D/g, '').length < 10) {
    return 'Informe um WhatsApp valido para contato.'
  }

  if (orderMode === 'delivery') {
    if (checkoutChannels?.deliveryEnabled === false) {
      return 'Delivery desativado para o cardapio digital.'
    }

    if (!customer.address.trim()) {
      return 'Informe endereco e numero para delivery.'
    }

    if (!customer.neighborhood.trim()) {
      return 'Informe o bairro para calcular a taxa de entrega.'
    }

    if (deliveryRequiresKnownNeighborhood && !selectedNeighborhoodFound) {
      return 'Este bairro nao esta atendido no checkout digital.'
    }
  }

  if (orderMode === 'pickup' && checkoutChannels?.pickupEnabled === false) {
    return 'Retirada desativada para o cardapio digital.'
  }

  if (!selectedPaymentMethod) {
    return 'Escolha uma forma de pagamento.'
  }

  if (!selectedPaymentMethod.availableForCheckout) {
    return selectedPaymentMethod.unavailableReason ?? 'Forma de pagamento indisponivel.'
  }

  return null
}

function readPrefillFromUrl(source: CatalogMenuSource): PrefillResult | null {
  if (typeof window === 'undefined') {
    return null
  }

  const encoded = new URLSearchParams(window.location.search).get('cart')
  if (!encoded) {
    return null
  }

  const payload = parsePrefillPayload(encoded)
  if (!payload) {
    return null
  }

  const productsById = new Map(
    source.categories.flatMap((category) => category.products.map((product) => [product.id, product])),
  )
  const cartItems: DigitalCartItem[] = []
  let droppedItems = 0

  for (const item of payload.items) {
    const product = productsById.get(item.productId)
    if (!product?.orderable) {
      droppedItems += 1
      continue
    }

    const options = resolvePrefillOptions(product, item.selectedOptions ?? [])
    cartItems.push({
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      quantity: item.quantity ?? 1,
      unitPrice: product.price,
      notes: item.notes ?? '',
      options,
    })
  }

  return {
    cartItems,
    droppedItems,
    orderMode: payload.orderMode,
    customer: {
      name: payload.customerName,
      phone: payload.customerPhone,
      address: payload.address,
      neighborhood: payload.neighborhood,
      notes: payload.notes,
    },
  }
}

interface PrefillPayload {
  customerName?: string
  customerPhone?: string
  address?: string
  neighborhood?: string
  notes?: string
  orderMode?: DigitalOrderMode
  items: PrefillItem[]
}

interface PrefillItem {
  productId: string
  quantity?: number
  notes?: string
  selectedOptions?: Array<{
    groupId: string
    optionId: string
    quantity?: number
  }>
}

function parsePrefillPayload(encoded: string): PrefillPayload | null {
  const decoded = decodeUrlPayload(encoded)
  if (!decoded) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(decoded)

    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      return null
    }

    const items = parsed.items
      .map(readPrefillItem)
      .filter((item): item is PrefillItem => item !== null)

    return {
      customerName: readOptionalString(parsed.customerName),
      customerPhone: readOptionalString(parsed.customerPhone),
      address: readOptionalString(parsed.address),
      neighborhood: readOptionalString(parsed.neighborhood),
      notes: readOptionalString(parsed.notes),
      orderMode: parsed.orderMode === 'pickup' || parsed.orderMode === 'delivery'
        ? parsed.orderMode
        : undefined,
      items,
    }
  } catch {
    return null
  }
}

function decodeUrlPayload(encoded: string) {
  try {
    return atob(encoded)
  } catch {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return null
    }
  }
}

function readPrefillItem(value: unknown): PrefillItem | null {
  if (!isRecord(value) || typeof value.productId !== 'string') {
    return null
  }

  const selectedOptions = Array.isArray(value.selectedOptions)
    ? value.selectedOptions
        .map((option) => {
          if (
            !isRecord(option) ||
            typeof option.groupId !== 'string' ||
            typeof option.optionId !== 'string'
          ) {
            return null
          }

          return {
            groupId: option.groupId,
            optionId: option.optionId,
            quantity: typeof option.quantity === 'number' ? option.quantity : undefined,
          }
        })
        .filter((option): option is NonNullable<typeof option> => option !== null)
    : undefined

  return {
    productId: value.productId,
    quantity:
      typeof value.quantity === 'number' && Number.isFinite(value.quantity)
        ? Math.max(1, Math.round(value.quantity))
        : undefined,
    notes: readOptionalString(value.notes),
    selectedOptions,
  }
}

function resolvePrefillOptions(
  product: CatalogMenuProduct,
  selectedOptions: NonNullable<PrefillItem['selectedOptions']>,
): OrderItemOption[] {
  return selectedOptions.flatMap((selection) => {
    const group = product.optionGroups.find((entry) => entry.id === selection.groupId)
    const option = group?.options.find((entry) => entry.id === selection.optionId)

    if (!group || !option || option.orderable === false || !option.active || !option.available || option.soldOut) {
      return []
    }

    return [
      {
        id: option.id,
        groupId: group.id,
        groupName: group.name,
        name: option.name,
        quantity: selection.quantity ?? 1,
        price: option.priceDelta,
      },
    ]
  })
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
