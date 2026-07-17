import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  Armchair,
  Bike,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  ClipboardList,
  Filter,
  Flame,
  History,
  Info,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UsersRound,
  Utensils,
  WalletCards,
  X,
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
import type { CustomerAddressPayload } from '@/contracts'
import {
  useAddTableSessionItemsMutation,
  useCatalogMenuSourceQuery,
  useCloseTableSessionMutation,
  useCreateCustomerMutation,
  useCreateOrderMutation,
  useCustomerByIdQuery,
  useCustomersQuery,
  useDiningTablesQuery,
  useOpenTableSessionMutation,
  usePromotionsQuery,
  useStoreSettingsQuery,
  useTransferTableSessionMutation,
  useUpdateCustomerMutation,
  useWaitersQuery,
} from '@/hooks/queries'
import { useMarkOrderDraftConvertedMutation } from '@/hooks/queries/ai-attendant'
import { usePageTitle } from '@/hooks/use-page-title'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency } from '@/lib/format'
import {
  formatWhatsAppNumber,
  normalizeWhatsAppNumber,
} from '@/lib/phone'
import { cn } from '@/lib/utils'
import { useNewOrderStore } from '@/stores'
import { useToastStore } from '@/stores/toast-store'
import type {
  Category,
  Customer,
  CustomerAddress,
  DiningTable,
  OrderChannel,
  OrderItemOption,
  PaymentMethod,
  Product,
  ProductChannel,
  TableSession,
  TableStatus,
} from '@/types'

type ServiceMode = 'delivery-counter' | 'tables'
type FlowStep = 'customer' | 'tables' | 'menu'
type TableStatusTab = 'free' | 'occupied' | 'reserved'

type CustomerFormState = {
  name: string
  phone: string
  street: string
  number: string
  district: string
  city: string
  state: string
  complement: string
  reference: string
  notes: string
}

const emptyCustomers: Customer[] = []
const emptyTables: DiningTable[] = []
const emptySessions: TableSession[] = []
const DELIVERY_FEE = 8.5

const panelClass =
  'rounded-xl border border-border bg-white shadow-sm'
const inputClass =
  'h-11 rounded-lg border-border bg-white text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20'
const iconBoxClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-primary'

export function NewOrderPage() {
  usePageTitle('Novo pedido')
  const navigate = useNavigate()
  const { pushToast } = useToastStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [
    channel,
    customerId,
    addressId,
    tableId,
    tableSessionId,
    paymentMethod,
    notes,
    sendToProduction,
    sourceAiOrderDraftId,
    draftSavedAt,
    cartItems,
    setChannel,
    setCustomerId,
    setAddressId,
    setTableId,
    setTableSessionId,
    setPaymentMethod,
    setNotes,
    setSendToProduction,
    setSourceAiOrderDraftId,
    saveDraft,
    replaceCartItems,
    addProduct,
    addConfiguredProduct,
    removeItem,
    updateQuantity,
    updateItemNotes,
    reset,
  ] = useNewOrderStore(
    useShallow((state) => [
      state.channel,
      state.customerId,
      state.addressId,
      state.tableId,
      state.tableSessionId,
      state.paymentMethod,
      state.notes,
      state.sendToProduction,
      state.sourceAiOrderDraftId,
      state.draftSavedAt,
      state.cartItems,
      state.setChannel,
      state.setCustomerId,
      state.setAddressId,
      state.setTableId,
      state.setTableSessionId,
      state.setPaymentMethod,
      state.setNotes,
      state.setSendToProduction,
      state.setSourceAiOrderDraftId,
      state.saveDraft,
      state.replaceCartItems,
      state.addProduct,
      state.addConfiguredProduct,
      state.removeItem,
      state.updateQuantity,
      state.updateItemNotes,
      state.reset,
    ]),
  )
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    channel === 'dine_in' ? 'tables' : 'delivery-counter',
  )
  const [flowStep, setFlowStep] = useState<FlowStep>(
    channel === 'dine_in' ? 'tables' : 'customer',
  )
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [customerSearchMessage, setCustomerSearchMessage] = useState<string | null>(null)
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(() => emptyCustomerForm())
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] = useState<Customer | null>(null)
  const [incomingOrderText, setIncomingOrderText] = useState('')
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('featured')
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  const [tableStatusTab, setTableStatusTab] = useState<TableStatusTab>('free')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(tableId)
  const [guestCountDraft, setGuestCountDraft] = useState(2)
  const [waiterIdDraft, setWaiterIdDraft] = useState('none')
  const [transferTargetTableId, setTransferTargetTableId] = useState('none')
  const [isSubmittingSession, setIsSubmittingSession] = useState(false)

  const debouncedCustomerSearch = useDebouncedValue(customerSearchTerm, 350)
  const canSearchCustomer = isCustomerSearchReady(debouncedCustomerSearch)
  const settingsQuery = useStoreSettingsQuery()
  const customerDetailQuery = useCustomerByIdQuery(customerId)
  const customerSearchQuery = useCustomersQuery(
    { filters: { q: debouncedCustomerSearch, pageSize: 20 } },
    { enabled: canSearchCustomer },
  )
  const diningQuery = useDiningTablesQuery()
  const waitersQuery = useWaitersQuery()
  const promotionsQuery = usePromotionsQuery()
  const createCustomerMutation = useCreateCustomerMutation()
  const updateCustomerMutation = useUpdateCustomerMutation()
  const createOrderMutation = useCreateOrderMutation()
  const markOrderDraftConverted = useMarkOrderDraftConvertedMutation()
  const openTableSessionMutation = useOpenTableSessionMutation()
  const addTableSessionItemsMutation = useAddTableSessionItemsMutation()
  const closeTableSessionMutation = useCloseTableSessionMutation()
  const transferTableSessionMutation = useTransferTableSessionMutation()

  const catalogChannel = resolveCatalogChannel(channel)
  const menuSourceQuery = useCatalogMenuSourceQuery({
    channel: catalogChannel,
    includeUnavailable: true,
  })

  const categories = useMemo(
    () =>
      (menuSourceQuery.data?.data.categories ?? [])
        .filter((category) => category.visibleForChannel)
        .map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          active: category.active,
          icon: category.icon,
          color: category.color,
          visibleOnPos: category.visibleOnPos,
          visibleOnDigitalMenu: category.visibleOnDigitalMenu,
          sortOrder: category.sortOrder,
          productCount: category.products.length,
        })),
    [menuSourceQuery.data?.data.categories],
  )
  const products = useMemo(
    () =>
      (menuSourceQuery.data?.data.categories ?? []).flatMap((category) =>
        category.products.map((product): Product => ({
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          price: product.basePrice,
          image: product.image,
          featured: product.featured,
          active: product.active,
          preparationStation: product.preparationStation,
          sortOrder: product.sortOrder,
          tags: product.tags,
          availability: product.channelAvailability ? [product.channelAvailability] : [],
          optionGroups: product.optionGroups,
        })),
      ),
    [menuSourceQuery.data?.data.categories],
  )
  const searchedCustomers = customerSearchQuery.data?.data ?? emptyCustomers
  const tables = diningQuery.data?.data.tables ?? emptyTables
  const sessions = diningQuery.data?.data.sessions ?? emptySessions
  const waiters = waitersQuery.data?.data ?? []
  const promotions = (promotionsQuery.data?.data ?? []).filter(
    (promotion) => promotion.status === 'active',
  )

  const customer = customerDetailQuery.data?.data ?? selectedCustomerSnapshot
  const selectedAddress =
    customer?.addresses.find((address) => address.id === addressId) ??
    customer?.addresses[0] ??
    null
  const selectedTable =
    tables.find((table) => table.id === (selectedTableId ?? tableId)) ?? null
  const selectedSession =
    sessions.find((session) => session.id === tableSessionId) ??
    sessions.find((session) => session.id === selectedTable?.currentSessionId) ??
    null

  const shouldShowCustomerResults = canSearchCustomer && searchedCustomers.length > 0
  const shouldShowCreateCustomer =
    canSearchCustomer && !customerSearchQuery.isFetching && searchedCustomers.length === 0

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const availability = getProductAvailability(product, catalogChannel)
        const matchesCategory =
          selectedCategoryId === 'all' ||
          (selectedCategoryId === 'featured' ? product.featured : product.categoryId === selectedCategoryId)
        const matchesSearch =
          !search.trim() ||
          `${product.name} ${product.description} ${product.tags.join(' ')} ${
            categories.find((category) => category.id === product.categoryId)?.name ?? ''
          }`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        const categoryEnabled = categories.some((category) => category.id === product.categoryId)
        const isVisible = product.active && categoryEnabled && Boolean(availability?.visible)
        const canAdd = isProductOrderable(product, catalogChannel)

        return matchesCategory && matchesSearch && isVisible && (!showOnlyAvailable || canAdd)
      }),
    [catalogChannel, categories, products, search, selectedCategoryId, showOnlyAvailable],
  )
  const productSections = useMemo(
    () => buildProductSections(visibleProducts, categories, selectedCategoryId),
    [categories, selectedCategoryId, visibleProducts],
  )
  const activeProductId = visibleProducts.some((product) => product.id === selectedProductId)
    ? selectedProductId
    : visibleProducts[0]?.id ?? null
  const selectedProduct =
    visibleProducts.find((product) => product.id === activeProductId) ?? null
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null)
  const [optionSelections, setOptionSelections] = useState<Record<string, string[]>>({})
  const [configuratorNotes, setConfiguratorNotes] = useState('')
  const [configuratorErrors, setConfiguratorErrors] = useState<string[]>([])
  const configuringBasePrice = configuringProduct
    ? getProductPrice(configuringProduct, catalogChannel)
    : 0
  const configuringOptions = configuringProduct
    ? buildSelectedCartOptions(configuringProduct, optionSelections)
    : []
  const configuringOptionsTotal = getOptionsTotal(configuringOptions)

  const tableStats = useMemo(
    () => ({
      free: tables.filter(isTableFree).length,
      occupied: tables.filter(isTableOccupied).length,
      reserved: tables.filter((table) => table.status === 'reserved').length,
    }),
    [tables],
  )
  const filteredTables = tables.filter((table) => {
    const normalizedSearch = tableSearch.trim().toLowerCase()
    const session = sessions.find((entry) => entry.id === table.currentSessionId)
    const matchesSearch =
      !normalizedSearch ||
      `mesa ${table.code} ${table.code} ${table.waiterName ?? ''} ${table.notes ?? ''} ${
        session?.notes ?? ''
      }`
        .toLowerCase()
        .includes(normalizedSearch)
    const matchesStatus =
      tableStatusTab === 'free'
        ? isTableFree(table)
        : tableStatusTab === 'occupied'
          ? isTableOccupied(table)
          : table.status === 'reserved'

    return matchesSearch && matchesStatus
  })
  const freeTables = tables.filter((table) => isTableFree(table) && table.id !== selectedTable?.id)

  const subtotal = cartItems.reduce((sum, item) => sum + getCartItemUnitTotal(item) * item.quantity, 0)
  const deliveryFee = channel === 'delivery' && cartItems.length ? DELIVERY_FEE : 0
  const total = subtotal + deliveryFee
  const canContinueCustomer =
    Boolean(customerId) &&
    (channel === 'delivery' ? Boolean(addressId) && Boolean(customer?.phone) : true)
  const canConfirmDeliveryOrder =
    serviceMode === 'delivery-counter' &&
    cartItems.length > 0 &&
    canContinueCustomer &&
    !createOrderMutation.isPending
  const canConfirmTableOrder =
    serviceMode === 'tables' &&
    cartItems.length > 0 &&
    Boolean(tableSessionId || selectedSession?.id) &&
    !isSubmittingSession
  const isCatalogLoading = menuSourceQuery.isLoading
  const isCustomerSaving = createCustomerMutation.isPending || updateCustomerMutation.isPending

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
          unitPrice: getProductPrice(product, catalogChannel),
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
  }, [cartItems, catalogChannel, products, replaceCartItems])

  const updateCustomerForm = (field: keyof CustomerFormState, value: string) => {
    setCustomerForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSearchCustomer = () => {
    const normalized = normalizeWhatsAppNumber(customerSearchTerm)

    if (!isCustomerSearchReady(customerSearchTerm)) {
      setCustomerSearchMessage('Digite pelo menos 2 letras do nome ou um WhatsApp com DDD.')
      return
    }

    if (normalized.length >= 8) {
      updateCustomerForm('phone', formatWhatsAppNumber(customerSearchTerm))
    }
    setCustomerSearchMessage(null)
  }

  const handleSelectCustomer = (nextCustomer: Customer) => {
    setCustomerId(nextCustomer.id)
    setAddressId(nextCustomer.addresses[0]?.id ?? null)
    setSelectedCustomerSnapshot(nextCustomer)
    setCustomerForm(customerToForm(nextCustomer))
    setIsEditingCustomer(false)
  }

  const handleStartEditingCustomer = (nextCustomer: Customer) => {
    handleSelectCustomer(nextCustomer)
    setIsEditingCustomer(true)
  }

  const handleCreateCustomer = async () => {
    const address = formToAddressPayload(customerForm)

    if (customerForm.name.trim().length < 2 || normalizeWhatsAppNumber(customerForm.phone).length < 8) {
      setCustomerSearchMessage('Informe nome e WhatsApp para cadastrar rapidamente.')
      return
    }

    const response = await createCustomerMutation.mutateAsync({
      name: customerForm.name.trim(),
      phone: formatWhatsAppNumber(customerForm.phone),
      notes: customerForm.notes.trim() || undefined,
      address,
    })
    handleSelectCustomer(response.data)
    setCustomerSearchTerm(response.data.phone)
  }

  const handleUpdateCustomer = async () => {
    if (!customerId) {
      await handleCreateCustomer()
      return
    }

    const address = formToAddressPayload(customerForm)
    const response = await updateCustomerMutation.mutateAsync({
      customerId,
      name: customerForm.name.trim(),
      phone: formatWhatsAppNumber(customerForm.phone),
      notes: customerForm.notes.trim() || undefined,
      address,
    })
    handleSelectCustomer(response.data)
  }

  const handleSwitchServiceMode = (nextMode: ServiceMode) => {
    setServiceMode(nextMode)

    if (nextMode === 'tables') {
      setChannel('dine_in')
      setFlowStep('tables')
      return
    }

    if (channel === 'dine_in') {
      setChannel('delivery')
    }
    setFlowStep(customer ? 'menu' : 'customer')
  }

  const handleChannelChange = (nextChannel: 'delivery' | 'counter') => {
    setChannel(nextChannel)
    if (nextChannel === 'counter') {
      setAddressId(null)
    }
  }

  const handleAddProduct = (product: Product) => {
    if (!isProductOrderable(product, catalogChannel)) {
      return
    }

    if (product.optionGroups?.length) {
      setConfiguringProduct(product)
      setOptionSelections(buildDefaultOptionSelections(product))
      setConfiguratorNotes('')
      setConfiguratorErrors([])
      return
    }

    addProduct(product.id, product.name, getProductPrice(product, catalogChannel))
  }

  const handleToggleOption = (groupId: string, optionId: string) => {
    if (!configuringProduct) {
      return
    }

    const group = configuringProduct.optionGroups?.find((entry) => entry.id === groupId)
    const option = group?.options.find((entry) => entry.id === optionId)

    if (!group || !option) {
      return
    }

    if (!isOptionOrderable(option)) {
      setConfiguratorErrors([`${option.name} esta indisponivel no catalogo.`])
      return
    }

    setOptionSelections((current) => {
      const currentSelection = current[groupId] ?? []
      const hasOption = currentSelection.includes(optionId)

      if (hasOption) {
        return {
          ...current,
          [groupId]: currentSelection.filter((entry) => entry !== optionId),
        }
      }

      if (group.maxSelections === 1) {
        return {
          ...current,
          [groupId]: [optionId],
        }
      }

      if (currentSelection.length >= group.maxSelections) {
        setConfiguratorErrors([buildOptionLimitMessage(configuringProduct, group.maxSelections)])
        return current
      }

      return {
        ...current,
        [groupId]: [...currentSelection, optionId],
      }
    })
  }

  const handleConfirmConfiguredProduct = () => {
    if (!configuringProduct) {
      return
    }

    const errors = validateOptionSelections(configuringProduct, optionSelections)

    if (errors.length) {
      setConfiguratorErrors(errors)
      return
    }

    const options = buildSelectedCartOptions(configuringProduct, optionSelections)
    addConfiguredProduct(
      configuringProduct.id,
      configuringProduct.name,
      getProductPrice(configuringProduct, catalogChannel),
      options,
      configuratorNotes.trim() || undefined,
    )
    setConfiguringProduct(null)
    setConfiguratorErrors([])
  }

  const handleSelectTable = (table: DiningTable) => {
    setSelectedTableId(table.id)
    setTableId(table.id)
    setTableSessionId(table.currentSessionId ?? null)
    setGuestCountDraft(table.guests ?? getDefaultGuestCount(table))
    setWaiterIdDraft(table.waiterId ?? 'none')
  }

  const handleOpenOrContinueTable = async (table: DiningTable) => {
    const nextGuestCount = table.id === selectedTableId ? guestCountDraft : getDefaultGuestCount(table)
    const nextWaiterId = table.id === selectedTableId ? waiterIdDraft : table.waiterId ?? 'none'

    handleSelectTable(table)

    if (table.status === 'reserved') {
      return
    }

    if (table.currentSessionId) {
      setTableSessionId(table.currentSessionId)
      setFlowStep('menu')
      return
    }

    const response = await openTableSessionMutation.mutateAsync({
      tableId: table.id,
      guestCount: nextGuestCount,
      waiterId: nextWaiterId === 'none' ? undefined : nextWaiterId,
      notes,
    })
    setTableSessionId(response.data.id)
    setFlowStep('menu')
  }

  const handleConfirmOrder = async () => {
    if (serviceMode === 'tables') {
      const sessionId = tableSessionId ?? selectedSession?.id

      if (!sessionId || !canConfirmTableOrder) {
        return
      }

      setIsSubmittingSession(true)
      try {
        await addTableSessionItemsMutation.mutateAsync({
          sessionId,
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes,
            options: toOptionRequestItems(item.options),
          })),
        })
        reset()
        navigate('/dining/tables')
      } finally {
        setIsSubmittingSession(false)
      }
      return
    }

    if (!canConfirmDeliveryOrder) {
      return
    }

    const response = await createOrderMutation.mutateAsync({
      channel,
      customerId,
      addressId,
      tableId: null,
      paymentMethod,
      notes,
      sendToProduction,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        options: toOptionRequestItems(item.options),
      })),
    })
    if (sourceAiOrderDraftId) {
      try {
        await markOrderDraftConverted.mutateAsync({
          id: sourceAiOrderDraftId,
          orderId: response.data.id,
        })
        setSourceAiOrderDraftId(null)
      } catch {
        pushToast({
          title: 'Pedido criado, mas draft IA nao foi marcado como convertido',
          description: 'O pedido real foi criado. A metrica de conversao pode precisar de revisao.',
          variant: 'warning',
        })
      }
    }
    reset()
    navigate(`/orders/${response.data.id}`)
  }

  const handleCloseSession = () => {
    if (!selectedSession) {
      return
    }

    closeTableSessionMutation.mutate({
      sessionId: selectedSession.id,
      paymentMethod,
      actor: 'Operacao',
    })
  }

  const handleTransferSession = () => {
    if (!selectedSession || transferTargetTableId === 'none') {
      return
    }

    transferTableSessionMutation.mutate({
      sessionId: selectedSession.id,
      targetTableId: transferTargetTableId,
      actor: 'Operacao',
    })
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !isEditableElement(document.activeElement)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === 'Escape') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        setSearch('')
        return
      }

      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        void handleConfirmOrder()
        return
      }

      if (
        event.key === 'Enter' &&
        flowStep === 'menu' &&
        selectedProduct &&
        !isEditableElement(document.activeElement)
      ) {
        event.preventDefault()
        handleAddProduct(selectedProduct)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const renderServiceTabs = () => (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => handleSwitchServiceMode('delivery-counter')}
        className={cn(
          'inline-flex h-12 items-center gap-3 rounded-2xl border px-5 text-sm font-black transition',
          serviceMode === 'delivery-counter'
            ? 'border-orange-500/70 bg-orange-500/12 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.18),0_18px_42px_rgba(249,115,22,0.14)]'
            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-orange-500/40 hover:text-white',
        )}
      >
        <Bike className="h-5 w-5 text-orange-300" />
        Delivery e balcao
      </button>
      <button
        type="button"
        onClick={() => handleSwitchServiceMode('tables')}
        className={cn(
          'inline-flex h-12 items-center gap-3 rounded-2xl border px-5 text-sm font-black transition',
          serviceMode === 'tables'
            ? 'border-orange-500/70 bg-orange-500/12 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.18),0_18px_42px_rgba(249,115,22,0.14)]'
            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-orange-500/40 hover:text-white',
        )}
      >
        <Armchair className="h-5 w-5 text-orange-300" />
        Mesas e comandas
      </button>
    </div>
  )

  return (
    <PageShell className="min-h-[calc(100vh-72px)] space-y-5">
      <header className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <div className="mb-5">{renderServiceTabs()}</div>
          <p className="text-sm font-black text-orange-400">PDV operacional Cain Delivery</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Novo pedido
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Identifique o cliente, escolha mesa quando necessario e monte o carrinho com o
            catalogo real da loja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
          {(['customer', 'menu'] as FlowStep[]).map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setFlowStep(step)}
              disabled={step === 'menu' && serviceMode === 'delivery-counter' && !canContinueCustomer}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-45',
                flowStep === step
                  ? 'bg-orange-500 text-white shadow-[0_14px_34px_rgba(249,115,22,0.24)]'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 font-mono text-[11px]">
                {index + 1}
              </span>
              {step === 'customer' ? 'Cliente' : 'Pedido'}
            </button>
          ))}
        </div>
      </header>

      {flowStep === 'customer' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <section aria-label="Identificacao do cliente" className="space-y-5">
            <section className={cn(panelClass, 'p-5 sm:p-6')}>
              <div className="mb-5">
                <h2 className="text-3xl font-black tracking-tight text-white">
                  Identificar cliente pelo WhatsApp
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Digite nome ou cole o numero para buscar no cadastro e aproveitar dados ja salvos.
                </p>
              </div>

              <form
                className="grid gap-3 lg:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleSearchCustomer()
                }}
              >
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                    Cliente
                  </span>
                  <span className="relative block">
                    <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-300" />
                    <Input
                      value={customerSearchTerm}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setCustomerSearchTerm(nextValue)
                        if (
                          normalizeWhatsAppNumber(nextValue).length >= 8 &&
                          !customerForm.phone.trim() &&
                          !customerId
                        ) {
                          updateCustomerForm('phone', formatWhatsAppNumber(nextValue))
                        }
                        setCustomerSearchMessage(null)
                      }}
                      placeholder="Digite nome ou WhatsApp do cliente"
                      className={cn(inputClass, 'h-14 pl-12 text-base')}
                    />
                    {customerSearchTerm ? (
                      <button
                        type="button"
                        onClick={() => setCustomerSearchTerm('')}
                        className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white"
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </span>
                </label>
                <Button
                  type="submit"
                  disabled={customerSearchQuery.isFetching}
                  className="h-14 self-end rounded-2xl px-6 text-sm font-black"
                >
                  <Search className="h-5 w-5" />
                  {customerSearchQuery.isFetching ? 'Buscando...' : 'Buscar cliente'}
                </Button>
              </form>

              <p className="mt-3 text-sm text-slate-500">
                A busca acontece enquanto voce digita. Telefones sao normalizados com mascara,
                espaco, hifen, DDI ou apenas numeros.
              </p>
              {customerSearchMessage ? (
                <p className="mt-3 rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200">
                  {customerSearchMessage}
                </p>
              ) : null}
            </section>

            {shouldShowCustomerResults ? (
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-cyan-300">
                  <UsersRound className="h-5 w-5" />
                  {searchedCustomers.length} cliente{searchedCustomers.length > 1 ? 's' : ''} encontrado{searchedCustomers.length > 1 ? 's' : ''}
                </h3>
                {searchedCustomers.map((entry) => (
                  <CustomerResultCard
                    key={entry.id}
                    customer={entry}
                    selected={entry.id === customerId}
                    addressId={entry.id === customerId ? addressId : entry.addresses[0]?.id}
                    onAddressChange={(nextAddressId) => {
                      handleSelectCustomer(entry)
                      setAddressId(nextAddressId)
                      setCustomerForm(customerToForm(entry, nextAddressId))
                    }}
                    onEdit={() => handleStartEditingCustomer(entry)}
                    onUse={() => handleSelectCustomer(entry)}
                  />
                ))}
              </section>
            ) : null}

            {shouldShowCreateCustomer ? (
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-orange-200">
                  <UsersRound className="h-5 w-5" />
                  Cliente nao encontrado. Criar novo cliente?
                </h3>
              </section>
            ) : null}

            <section className={cn(panelClass, 'p-5 sm:p-6')}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-black text-cyan-300">
                  <UsersRound className="h-5 w-5" />
                  {isEditingCustomer ? 'Editar dados antes de continuar' : 'Nao encontrou? Criar novo cliente'}
                </h3>
                {isEditingCustomer ? (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-200">
                    Sincroniza no cadastro real
                  </span>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-[0.85fr_0.95fr_1.2fr]">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    WhatsApp
                  </span>
                  <Input
                    value={customerForm.phone}
                    onChange={(event) => updateCustomerForm('phone', event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Nome
                  </span>
                  <Input
                    value={customerForm.name}
                    onChange={(event) => updateCustomerForm('name', event.target.value)}
                    placeholder="Ex.: Bruno Almeida"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Rua / avenida
                  </span>
                  <Input
                    value={customerForm.street}
                    onChange={(event) => updateCustomerForm('street', event.target.value)}
                    placeholder="Ex.: Rua das Palmeiras"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.5fr_0.8fr_0.8fr_0.4fr]">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Numero
                  </span>
                  <Input
                    value={customerForm.number}
                    onChange={(event) => updateCustomerForm('number', event.target.value)}
                    placeholder="123"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Bairro
                  </span>
                  <Input
                    value={customerForm.district}
                    onChange={(event) => updateCustomerForm('district', event.target.value)}
                    placeholder="Centro"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Cidade
                  </span>
                  <Input
                    value={customerForm.city}
                    onChange={(event) => updateCustomerForm('city', event.target.value)}
                    placeholder="Manaus"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    UF
                  </span>
                  <Input
                    value={customerForm.state}
                    onChange={(event) => updateCustomerForm('state', event.target.value.toUpperCase())}
                    placeholder="AM"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Complemento
                  </span>
                  <Input
                    value={customerForm.complement}
                    onChange={(event) => updateCustomerForm('complement', event.target.value)}
                    placeholder="Apto, bloco, ponto de entrega"
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Referencia
                  </span>
                  <Input
                    value={customerForm.reference}
                    onChange={(event) => updateCustomerForm('reference', event.target.value)}
                    placeholder="Perto de..."
                    className={inputClass}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Observacao do cliente
                  </span>
                  <Input
                    value={customerForm.notes}
                    onChange={(event) => updateCustomerForm('notes', event.target.value)}
                    placeholder="Ex.: sem cebola, ligar ao chegar"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Info className="h-4 w-4 text-cyan-300" />
                  Use os dados enviados na mensagem para completar rapidamente.
                </p>
                <Button
                  type="button"
                  variant={isEditingCustomer ? 'default' : 'outline'}
                  disabled={isCustomerSaving}
                  onClick={isEditingCustomer ? handleUpdateCustomer : handleCreateCustomer}
                  className="h-12 rounded-2xl px-5 font-black"
                >
                  {isEditingCustomer ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isCustomerSaving
                    ? 'Salvando...'
                    : isEditingCustomer
                      ? 'Salvar ajustes'
                      : 'Cadastrar e usar cliente'}
                </Button>
              </div>
            </section>
          </section>

          <aside className={cn(panelClass, 'sticky top-24 self-start overflow-hidden')}>
            <div className="border-b border-white/10 p-5">
              <h2 className="flex items-center gap-3 text-lg font-black text-white">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <MessageCircle className="h-5 w-5" />
                </span>
                Mensagem recebida
              </h2>
            </div>
            <div className="space-y-5 p-5">
              <MessageField icon={<UserRound className="h-4 w-4" />} label="Nome">
                {customerForm.name || customer?.name || 'Nao informado'}
              </MessageField>
              <MessageField icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp">
                {formatCandidatePhone(customerForm.phone || customerSearchTerm) || customer?.phone || 'Nao informado'}
              </MessageField>
              <MessageField icon={<MapPin className="h-4 w-4" />} label="Endereco">
                {formAddressToText(customerForm) || addressToText(selectedAddress) || 'Nao informado'}
              </MessageField>
              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <ReceiptText className="h-4 w-4" />
                  Pedido informado
                </span>
                <textarea
                  value={incomingOrderText}
                  onChange={(event) => setIncomingOrderText(event.target.value)}
                  placeholder="Ex.: 1x X-Bacon, 1x batata, 1x Coca-Cola"
                  className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-[#06111f] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                Confirme os dados antes de continuar.
              </div>
              <Button
                type="button"
                disabled={!canContinueCustomer}
                onClick={() => setFlowStep('menu')}
                className="h-14 w-full rounded-2xl text-base font-black"
              >
                Continuar para montar o pedido
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      {flowStep === 'tables' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
          <section aria-label="Selecao de mesa" className="space-y-5">
            <section className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <Input
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Buscar mesa, garcom ou cliente..."
                  className={cn(inputClass, 'h-14 pl-12 text-base')}
                />
              </div>
              <Button type="button" variant="outline" className="h-14 rounded-2xl px-5">
                <Filter className="h-5 w-5" />
                Filtros
              </Button>
              <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                {(['free', 'occupied', 'reserved'] as TableStatusTab[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTableStatusTab(status)}
                    className={cn(
                      'h-12 rounded-xl px-4 text-sm font-black transition',
                      tableStatusTab === status
                        ? status === 'free'
                          ? 'bg-emerald-400/15 text-emerald-200'
                          : status === 'reserved'
                            ? 'bg-violet-400/15 text-violet-200'
                            : 'bg-orange-400/15 text-orange-200'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
                    )}
                  >
                    {status === 'free' ? 'Livres' : status === 'occupied' ? 'Ocupadas' : 'Reservadas'}
                  </button>
                ))}
              </div>
            </section>

            <section className={cn(panelClass, 'grid gap-4 p-4 md:grid-cols-3')}>
              <TableStatCard
                icon={<Armchair className="h-6 w-6" />}
                label="Mesas livres"
                value={tableStats.free}
                tone="free"
                total={tables.length}
              />
              <TableStatCard
                icon={<UsersRound className="h-6 w-6" />}
                label="Ocupadas"
                value={tableStats.occupied}
                tone="occupied"
                total={tables.length}
              />
              <TableStatCard
                icon={<CalendarClock className="h-6 w-6" />}
                label="Reservadas"
                value={tableStats.reserved}
                tone="reserved"
                total={tables.length}
              />
            </section>

            {diningQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <Skeleton key={index} className="h-48 rounded-[24px] bg-white/10" />
                ))}
              </div>
            ) : filteredTables.length ? (
              <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredTables.map((table) => {
                  const session = sessions.find((entry) => entry.id === table.currentSessionId)

                  return (
                    <TableSelectionCard
                      key={table.id}
                      table={table}
                      session={session}
                      selected={table.id === selectedTable?.id}
                      busy={openTableSessionMutation.isPending}
                      onSelect={() => handleSelectTable(table)}
                      onPrimary={() => void handleOpenOrContinueTable(table)}
                    />
                  )
                })}
              </section>
            ) : (
              <EmptyState
                icon={<Armchair className="h-5 w-5" />}
                title="Nenhuma mesa encontrada"
                description="A busca atual nao encontrou mesas nessa situacao."
              />
            )}
          </section>

          <aside className={cn(panelClass, 'sticky top-24 self-start overflow-hidden')}>
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {selectedTable ? `Mesa ${selectedTable.code}` : 'Selecione uma mesa'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Detalhes da mesa selecionada e acoes reais da comanda.
                  </p>
                </div>
                {selectedTable ? (
                  <TableStatusBadge status={selectedTable.status} />
                ) : null}
              </div>
            </div>

            {selectedTable ? (
              <div className="space-y-5 p-5">
                <div className="grid gap-3">
                  <DetailRow label="Garcom" value={selectedTable.waiterName ?? 'Nao atribuido'} />
                  <DetailRow label="Cliente" value="Nao vinculado a sessao" />
                  <DetailRow
                    label="Pessoas"
                    value={
                      selectedSession
                        ? `${selectedSession.guestCount} pessoa(s)`
                        : `${guestCountDraft} pessoa(s)`
                    }
                  />
                  <DetailRow
                    label="Aberta ha"
                    value={selectedSession ? formatElapsedTime(selectedSession.openedAt) : 'Ainda fechada'}
                  />
                  <DetailRow
                    label="Total atual"
                    value={formatCurrency(selectedSession?.total ?? 0)}
                    strong
                  />
                </div>

                {!selectedSession && isTableFree(selectedTable) ? (
                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Pessoas
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={guestCountDraft}
                          onChange={(event) =>
                            setGuestCountDraft(Math.max(1, Number(event.target.value) || 1))
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Garcom
                        </span>
                        <Select value={waiterIdDraft} onValueChange={setWaiterIdDraft}>
                          <SelectTrigger className={inputClass}>
                            <SelectValue placeholder="Garcom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem garcom</SelectItem>
                            {waiters.map((waiter) => (
                              <SelectItem key={waiter.id} value={waiter.id}>
                                {waiter.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                  </div>
                ) : null}

                {selectedTable.status === 'reserved' ? (
                  <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-4 text-sm text-violet-100">
                    {selectedTable.notes ||
                      'Reserva marcada na mesa; os detalhes complementares ainda nao estao disponiveis.'}
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    Itens da comanda
                  </h3>
                  {selectedSession?.items.length ? (
                    <div className="space-y-3">
                      {selectedSession.items.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-[#06111f] p-3"
                        >
                          <div>
                            <p className="font-black text-white">{item.name}</p>
                            {item.options.length ? (
                              <div className="mt-1 space-y-0.5">
                                {item.options.map((option) => (
                                  <p key={`${item.id}-${option.groupId}-${option.id}`} className="text-xs text-slate-500">
                                    {option.groupName ? `${option.groupName}: ` : ''}
                                    {option.name}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {item.notes ? (
                              <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm text-slate-300">{item.quantity}x</p>
                            <p className="font-mono text-sm font-black text-white">
                              {formatCurrency(item.totalPrice)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-slate-500">
                      Nenhum item lancado na comanda.
                    </p>
                  )}
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Observacao
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ex.: cliente alergico a amendoim"
                    className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-[#06111f] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </label>

                {selectedSession ? (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTransferSession}
                        disabled={transferTargetTableId === 'none' || transferTableSessionMutation.isPending}
                        className="h-12 rounded-2xl"
                      >
                        Trocar mesa
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseSession}
                        disabled={closeTableSessionMutation.isPending}
                        className="h-12 rounded-2xl"
                      >
                        Fechar comanda
                      </Button>
                    </div>
                    <Select value={transferTargetTableId} onValueChange={setTransferTargetTableId}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Mesa destino" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecionar mesa livre</SelectItem>
                        {freeTables.map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            Mesa {table.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <Button
                  type="button"
                  disabled={selectedTable.status === 'reserved' || openTableSessionMutation.isPending}
                  onClick={() => void handleOpenOrContinueTable(selectedTable)}
                  className="h-14 w-full rounded-2xl text-base font-black"
                >
                  {selectedTable.currentSessionId ? 'Abrir / Continuar pedido' : 'Abrir comanda'}
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<Armchair className="h-5 w-5" />}
                  title="Mesa nao selecionada"
                  description="Escolha uma mesa no grid para abrir, continuar ou consultar a comanda."
                />
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {flowStep === 'menu' ? (
        <div className="grid gap-5 xl:h-[calc(100vh-230px)] xl:min-h-[620px] xl:grid-cols-[220px_minmax(0,1fr)_420px]">
          <aside className={cn(panelClass, 'min-h-0 overflow-hidden p-3')}>
            <nav className="h-full space-y-2 overflow-y-auto pr-1" aria-label="Categorias do cardapio">
              <CategoryButton
                active={selectedCategoryId === 'featured'}
                icon={<Flame className="h-5 w-5" />}
                label="Destaques"
                onClick={() => setSelectedCategoryId('featured')}
              />
              <CategoryButton
                active={selectedCategoryId === 'all'}
                icon={<Utensils className="h-5 w-5" />}
                label="Todos"
                onClick={() => setSelectedCategoryId('all')}
              />
              {categories.map((category) => (
                <CategoryButton
                  key={category.id}
                  active={selectedCategoryId === category.id}
                  icon={<ReceiptText className="h-5 w-5" />}
                  label={category.name}
                  onClick={() => setSelectedCategoryId(category.id)}
                />
              ))}
              {promotions.length ? (
                <CategoryButton
                  active={false}
                  icon={<WalletCards className="h-5 w-5" />}
                  label="Promocoes"
                  onClick={() => setSelectedCategoryId('all')}
                />
              ) : null}
            </nav>
          </aside>

          <section aria-label="Catalogo do pedido" className="min-h-0 overflow-hidden">
            <div className="space-y-5 xl:h-full xl:overflow-y-auto xl:pr-2">
            <section className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar produtos, combos, ingredientes..."
                  className={cn(inputClass, 'h-14 pl-12 text-base')}
                />
              </div>
              <Button
                type="button"
                variant={showOnlyAvailable ? 'default' : 'outline'}
                onClick={() => setShowOnlyAvailable((value) => !value)}
                className="h-14 rounded-2xl px-5"
              >
                <SlidersHorizontal className="h-5 w-5" />
                {showOnlyAvailable ? 'Disponiveis' : 'Todos'}
              </Button>
            </section>

            <section className={cn(panelClass, 'grid gap-3 p-4 lg:grid-cols-[1fr_1fr_0.8fr]')}>
              <OperationalStripItem
                icon={serviceMode === 'tables' ? <Armchair className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                label={serviceMode === 'tables' ? 'Mesa / comanda' : 'Cliente'}
                value={
                  serviceMode === 'tables'
                    ? selectedTable
                      ? `Mesa ${selectedTable.code}`
                      : 'Mesa nao selecionada'
                    : customer?.name ?? 'Cliente nao selecionado'
                }
              />
              <OperationalStripItem
                icon={<MapPin className="h-5 w-5" />}
                label={channel === 'delivery' ? 'Endereco de entrega' : 'Atendimento'}
                value={
                  channel === 'delivery'
                    ? addressToText(selectedAddress) || 'Endereco pendente'
                    : serviceMode === 'tables'
                      ? selectedSession
                        ? `Comanda ${selectedSession.id.slice(0, 8)}`
                        : 'Abrir comanda'
                      : 'Balcao'
                }
              />
              <OperationalStripItem
                icon={<Clock3 className="h-5 w-5" />}
                label="Previsao"
                value={buildEtaLabel(channel, settingsQuery.data?.data)}
                accent
              />
            </section>

            {serviceMode === 'delivery-counter' ? (
              <section className={cn(panelClass, 'flex flex-wrap items-center justify-between gap-3 p-3')}>
                <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => handleChannelChange('delivery')}
                    className={cn(
                      'h-11 rounded-xl px-4 text-sm font-black transition',
                      channel === 'delivery'
                        ? 'bg-cyan-400/15 text-cyan-100'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
                    )}
                  >
                    Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChannelChange('counter')}
                    className={cn(
                      'h-11 rounded-xl px-4 text-sm font-black transition',
                      channel === 'counter'
                        ? 'bg-cyan-400/15 text-cyan-100'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
                    )}
                  >
                    Balcao
                  </button>
                </div>
                {customer && customer.addresses.length > 0 && channel === 'delivery' ? (
                  <Select value={addressId ?? ''} onValueChange={setAddressId}>
                    <SelectTrigger className="h-11 w-full rounded-2xl border-white/10 bg-[#06111f] text-slate-100 sm:w-[320px]">
                      <SelectValue placeholder="Endereco de entrega" />
                    </SelectTrigger>
                    <SelectContent>
                      {customer.addresses.map((address) => (
                        <SelectItem key={address.id} value={address.id}>
                          {address.label} - {address.district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </section>
            ) : null}

            {isCatalogLoading ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-72 rounded-[24px] bg-white/10" />
                ))}
              </div>
            ) : productSections.length ? (
              <div className="space-y-8">
                {productSections.map((section) => (
                  <section key={section.id} className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-black text-white">{section.title}</h2>
                      <span className="text-sm font-semibold text-slate-500">
                        {section.products.length} item(ns)
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {section.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          channel={catalogChannel}
                          selected={product.id === activeProductId}
                          onSelect={() => setSelectedProductId(product.id)}
                          onAdd={() => handleAddProduct(product)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" />}
                title="Catalogo sem produtos disponiveis"
                description="A consulta atual nao retornou produtos visiveis para este canal."
              />
            )}
            </div>
          </section>

          <aside className={cn(panelClass, 'min-h-0 overflow-hidden xl:flex xl:h-full xl:flex-col')}>
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-white">Resumo do pedido</h2>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-orange-300 transition hover:bg-orange-500/10 hover:text-orange-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar pedido
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div className="rounded-2xl border border-white/10 bg-[#06111f] p-4">
                <div className="flex gap-3">
                  <span className={iconBoxClass}>
                    {serviceMode === 'tables' ? <Armchair className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">
                      {serviceMode === 'tables'
                        ? selectedTable
                          ? `Mesa ${selectedTable.code}`
                          : 'Mesa nao selecionada'
                        : customer?.name ?? 'Cliente nao selecionado'}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-400">
                      {serviceMode === 'tables'
                        ? selectedSession
                          ? `${selectedSession.guestCount} pessoa(s) - ${formatCurrency(selectedSession.total)} atual`
                          : 'Comanda ainda nao aberta'
                        : customer?.phone ?? 'WhatsApp pendente'}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {serviceMode === 'tables'
                        ? selectedSession?.notes || notes || 'Sem observacao na comanda'
                        : addressToText(selectedAddress) || channelLabelMap[channel]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {cartItems.length ? (
                  cartItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-[#06111f] p-3"
                    >
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-white">{item.name}</p>
                          <p className="mt-1 font-mono text-sm text-slate-400">
                            Base {formatCurrency(item.unitPrice)}
                          </p>
                          {item.options.length ? (
                            <div className="mt-2 space-y-1">
                              {item.options.map((option) => (
                                <p key={`${item.id}-${option.groupId}-${option.id}`} className="text-xs text-slate-500">
                                  {option.groupName ? `${option.groupName}: ` : ''}
                                  {option.name}
                                  {option.price > 0 ? ` (+${formatCurrency(option.price)})` : ''}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-orange-500/10 hover:text-orange-200"
                          aria-label={`Remover ${item.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex overflow-hidden rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="flex h-9 w-9 items-center justify-center bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
                            aria-label={`Diminuir ${item.name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="flex h-9 w-10 items-center justify-center font-mono text-sm font-black text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="flex h-9 w-9 items-center justify-center bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
                            aria-label={`Aumentar ${item.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="font-mono font-black text-white">
                          {formatCurrency(getCartItemUnitTotal(item) * item.quantity)}
                        </p>
                      </div>
                      <Input
                        value={item.notes ?? ''}
                        onChange={(event) => updateItemNotes(item.id, event.target.value)}
                        placeholder="Observacao do item"
                        className="mt-3 h-10 rounded-xl border-white/10 bg-white/[0.03] text-xs"
                      />
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-500">
                    Adicione itens para montar o carrinho.
                  </p>
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Observacao geral
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: retirar cebola, ponto da carne..."
                  className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-[#06111f] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Pagamento
                </span>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        'pix',
                        'credit_card',
                        'debit_card',
                        'cash',
                        'meal_voucher',
                        'payment_link',
                      ] as PaymentMethod[]
                    ).map((method) => (
                      <SelectItem key={method} value={method}>
                        {paymentLabelMap[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="font-black text-white">Enviar para producao</p>
                  <p className="mt-1 text-xs text-slate-500">Mantem o fluxo operacional rapido.</p>
                </div>
                <Switch checked={sendToProduction} onCheckedChange={setSendToProduction} />
              </div>

            </div>

            <div className="space-y-3 border-t border-white/10 bg-[#07111f]/95 p-5 shadow-[0_-24px_54px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="space-y-2 text-sm">
                <PriceRow label="Subtotal" value={subtotal} />
                <PriceRow label="Taxa de entrega" value={deliveryFee} />
                <PriceRow label="Desconto" value={0} muted />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black text-white">Total</p>
                  <p className="font-mono text-3xl font-black text-orange-300">
                    {formatCurrency(total)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveDraft}
                  className="h-12 rounded-2xl py-3 font-black"
                >
                  <ClipboardList className="h-4 w-4" />
                  Salvar rascunho
                </Button>
                <Button
                  type="button"
                  disabled={
                    serviceMode === 'tables' ? !canConfirmTableOrder : !canConfirmDeliveryOrder
                  }
                  onClick={() => void handleConfirmOrder()}
                  className="h-12 rounded-2xl py-3 font-black"
                >
                  <Check className="h-4 w-4" />
                  {createOrderMutation.isPending || isSubmittingSession
                    ? 'Confirmando...'
                    : serviceMode === 'tables'
                      ? 'Salvar e enviar para cozinha'
                      : 'Confirmar pedido'}
                </Button>
              </div>
              <p className="text-center text-xs text-slate-500">
                {draftSavedAt
                  ? `Rascunho salvo neste navegador as ${new Date(draftSavedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Rascunho tambem e salvo automaticamente neste navegador.'}
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      {configuringProduct ? (
        <ProductConfiguratorPanel
          product={configuringProduct}
          channel={catalogChannel}
          selections={optionSelections}
          notes={configuratorNotes}
          errors={configuratorErrors}
          basePrice={configuringBasePrice}
          optionsTotal={configuringOptionsTotal}
          onToggleOption={handleToggleOption}
          onNotesChange={setConfiguratorNotes}
          onClose={() => setConfiguringProduct(null)}
          onConfirm={handleConfirmConfiguredProduct}
        />
      ) : null}
    </PageShell>
  )
}

function CustomerResultCard({
  customer,
  selected,
  addressId,
  onAddressChange,
  onEdit,
  onUse,
}: {
  customer: Customer
  selected: boolean
  addressId?: string | null
  onAddressChange: (addressId: string) => void
  onEdit: () => void
  onUse: () => void
}) {
  return (
    <article
      className={cn(
        panelClass,
        'grid gap-4 p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center',
        selected && 'border-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.24),0_24px_70px_rgba(8,145,178,0.16)]',
      )}
    >
      <CustomerAvatar name={customer.name} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-xl font-black text-white">{customer.name}</h4>
          {customer.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-200"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <MessageCircle className="h-4 w-4 text-emerald-300" />
          {customer.phone}
        </p>
        <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-400">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          {addressToText(customer.addresses.find((address) => address.id === addressId) ?? customer.addresses[0]) ||
            'Sem endereco salvo'}
        </p>
        {customer.lastOrders?.length ? (
          <div className="mt-2 space-y-1 text-sm text-slate-500">
            <p className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              {customer.lastOrders.length} pedido(s) anteriores
            </p>
            <p>Ultimo pedido: {customer.lastOrders[0].items.join(', ') || customer.lastOrders[0].number}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {customer.addresses.length > 1 ? (
          <Select value={addressId ?? customer.addresses[0]?.id} onValueChange={onAddressChange}>
            <SelectTrigger className="h-11 min-w-56 rounded-2xl border-white/10 bg-[#06111f] text-slate-100">
              <SelectValue placeholder="Endereco" />
            </SelectTrigger>
            <SelectContent>
              {customer.addresses.map((address) => (
                <SelectItem key={address.id} value={address.id}>
                  {address.label} - {address.district}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Button type="button" variant="outline" onClick={onEdit} className="h-11 rounded-2xl">
            <Pencil className="h-4 w-4" />
            Editar dados
          </Button>
          <Button type="button" onClick={onUse} className="h-11 rounded-2xl">
            <Check className="h-4 w-4" />
            Usar este cliente
          </Button>
        </div>
      </div>
    </article>
  )
}

function CustomerAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.34),rgba(15,118,110,0.72))] text-xl font-black text-white shadow-[0_18px_50px_rgba(20,184,166,0.18)]">
      {getInitials(name)}
    </span>
  )
}

function MessageField({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <span className="mt-1 text-slate-500">{icon}</span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-100">{children}</p>
      </div>
    </div>
  )
}

function CategoryButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left text-sm font-black transition',
        active
          ? 'border-orange-500/60 bg-orange-500/16 text-orange-100 shadow-[inset_3px_0_0_rgba(249,115,22,0.85)]'
          : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white',
      )}
    >
      <span className={cn('text-slate-500', active && 'text-orange-300')}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function OperationalStripItem({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <span className={iconBoxClass}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className={cn('mt-1 truncate font-black text-white', accent && 'text-cyan-200')}>{value}</p>
      </div>
    </div>
  )
}

function ProductCard({
  product,
  channel,
  selected,
  onSelect,
  onAdd,
}: {
  product: Product
  channel: ProductChannel
  selected: boolean
  onSelect: () => void
  onAdd: () => void
}) {
  const canAdd = isProductOrderable(product, channel)
  const status = getProductStatus(product, channel)

  return (
    <article
      onMouseEnter={onSelect}
      className={cn(
        panelClass,
        'group overflow-hidden transition hover:-translate-y-0.5 hover:border-orange-400/35',
        selected && 'border-cyan-300/45 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_22px_60px_rgba(8,145,178,0.14)]',
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative aspect-[16/9] overflow-hidden bg-white/[0.03]">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
          {!canAdd ? (
            <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-[#06111f]/90 px-3 py-1 text-xs font-black text-slate-200 backdrop-blur">
              {status}
            </span>
          ) : null}
          {product.optionGroups?.length ? (
            <span className="absolute right-3 top-3 rounded-full border border-cyan-300/20 bg-cyan-400/12 px-3 py-1 text-xs font-black text-cyan-100 backdrop-blur">
              Configuravel
            </span>
          ) : null}
        </div>
      </button>
      <div className="space-y-4 p-4">
        <div>
          <h3 className="line-clamp-1 text-base font-black text-white">{product.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
            {product.description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-lg font-black text-orange-300">
            {formatCurrency(getProductPrice(product, channel))}
          </p>
          <button
            type="button"
            disabled={!canAdd}
            onClick={onAdd}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl border font-black transition',
              canAdd
                ? 'border-orange-400/50 bg-orange-500/10 text-orange-200 hover:bg-orange-500 hover:text-white'
                : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-600',
            )}
            aria-label={`Adicionar ${product.name}`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </article>
  )
}

function ProductConfiguratorPanel({
  product,
  channel,
  selections,
  notes,
  errors,
  basePrice,
  optionsTotal,
  onToggleOption,
  onNotesChange,
  onClose,
  onConfirm,
}: {
  product: Product
  channel: ProductChannel
  selections: Record<string, string[]>
  notes: string
  errors: string[]
  basePrice: number
  optionsTotal: number
  onToggleOption: (groupId: string, optionId: string) => void
  onNotesChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid bg-[#020712]/75 p-3 backdrop-blur-sm lg:place-items-center">
      <section className="max-h-[calc(100vh-24px)] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[#07111f] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="grid gap-4 border-b border-white/10 p-5 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              Produto configuravel
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">{product.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {product.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Fechar configurador"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid max-h-[calc(100vh-180px)] gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            {product.optionGroups?.map((group) => {
              const selected = selections[group.id] ?? []

              return (
                <section key={group.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{group.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.required ? 'Obrigatorio' : 'Opcional'} · min {group.minSelections} · max {group.maxSelections}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-200">
                      {selected.length}/{group.maxSelections}
                    </span>
                  </div>
                  {group.description ? (
                    <p className="mb-3 text-sm leading-6 text-slate-400">{group.description}</p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.options.map((option) => {
                      const active = selected.includes(option.id)
                      const disabled = !isOptionOrderable(option)

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => onToggleOption(group.id, option.id)}
                          className={cn(
                            'grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                            disabled
                              ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-slate-600'
                              : active
                              ? 'border-cyan-300/60 bg-cyan-400/12 text-white'
                              : 'border-white/10 bg-[#06111f] text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-400/8',
                          )}
                        >
                          <span>
                            <span className="block font-black">{option.name}</span>
                            {option.description ? (
                              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
                                {option.description}
                              </span>
                            ) : null}
                            {disabled ? (
                              <span className="mt-1 block text-xs font-semibold text-red-200">
                                Esgotado ou indisponivel
                              </span>
                            ) : null}
                          </span>
                          <span className="text-right">
                            {option.priceDelta > 0 ? (
                              <span className="block font-mono text-sm font-black text-orange-300">
                                +{formatCurrency(option.priceDelta)}
                              </span>
                            ) : null}
                            {active ? <Check className="ml-auto mt-1 h-4 w-4 text-cyan-200" /> : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Observacao do item
              </span>
              <textarea
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Ex.: massa bem assada, retirar cebola..."
                className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-[#06111f] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
              />
            </label>
          </div>

          <aside className="h-fit rounded-2xl border border-white/10 bg-[#06111f] p-4">
            <p className="text-sm font-black text-white">Resumo do item</p>
            <div className="mt-4 space-y-2 text-sm">
              <PriceRow label="Base" value={basePrice} />
              <PriceRow label="Adicionais" value={optionsTotal} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-black text-white">Total</span>
                <span className="font-mono text-2xl font-black text-orange-300">
                  {formatCurrency(basePrice + optionsTotal)}
                </span>
              </div>
            </div>
            {errors.length ? (
              <div className="mt-4 space-y-2">
                {errors.map((error) => (
                  <p
                    key={error}
                    className="rounded-2xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-100"
                  >
                    {error}
                  </p>
                ))}
              </div>
            ) : null}
            <Button type="button" onClick={onConfirm} className="mt-4 h-12 w-full rounded-2xl font-black">
              <Plus className="h-4 w-4" />
              Adicionar ao pedido
            </Button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Canal: {channel === 'dine_in' ? 'salao' : channel}
            </p>
          </aside>
        </div>
      </section>
    </div>
  )
}

function TableSelectionCard({
  table,
  session,
  selected,
  busy,
  onSelect,
  onPrimary,
}: {
  table: DiningTable
  session?: TableSession
  selected: boolean
  busy: boolean
  onSelect: () => void
  onPrimary: () => void
}) {
  return (
    <article
      className={cn(
        panelClass,
        'relative p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35',
        selected && 'border-cyan-300/70 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_24px_70px_rgba(8,145,178,0.18)]',
      )}
    >
      {selected ? (
        <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-[#06111f]">
          <Check className="h-5 w-5" />
        </span>
      ) : null}
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-3 pr-9">
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
              table.status === 'reserved'
                ? 'border-violet-300/20 bg-violet-400/10 text-violet-200'
                : isTableOccupied(table)
                  ? 'border-orange-300/20 bg-orange-400/10 text-orange-200'
                  : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
            )}
          >
            {isTableOccupied(table) ? <UsersRound className="h-6 w-6" /> : <Armchair className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <h3 className="text-xl font-black text-white">Mesa {table.code}</h3>
            <TableStatusText status={table.status} />
            <p className="mt-1 text-sm text-slate-400">{table.capacity} lugares</p>
          </div>
        </div>
        <div className="mt-5 min-h-16 space-y-2 text-sm text-slate-400">
          {table.waiterName ? (
            <p className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-slate-500" />
              {table.waiterName}
            </p>
          ) : null}
          {session ? (
            <>
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-500" />
                {formatElapsedTime(session.openedAt)}
              </p>
              <p className="font-mono font-black text-orange-300">{formatCurrency(session.total)}</p>
            </>
          ) : table.status === 'reserved' ? (
            <p className="flex items-center gap-2 text-violet-200">
              <CalendarClock className="h-4 w-4" />
              Reserva sem detalhe operacional
            </p>
          ) : null}
        </div>
      </button>
      <Button
        type="button"
        variant={isTableFree(table) ? 'outline' : table.status === 'reserved' ? 'secondary' : 'outline'}
        disabled={busy}
        onClick={onPrimary}
        className={cn(
          'mt-4 h-11 w-full rounded-2xl font-black',
          isTableFree(table) && 'border-emerald-300/30 text-emerald-200 hover:bg-emerald-400/10',
          isTableOccupied(table) && 'border-orange-300/30 text-orange-200 hover:bg-orange-400/10',
          table.status === 'reserved' && 'border-violet-300/30 text-violet-200 hover:bg-violet-400/10',
        )}
      >
        {isTableFree(table) ? 'Abrir comanda' : table.status === 'reserved' ? 'Ver reserva' : 'Continuar'}
      </Button>
    </article>
  )
}

function TableStatCard({
  icon,
  label,
  value,
  tone,
  total,
}: {
  icon: ReactNode
  label: string
  value: number
  tone: TableStatusTab
  total: number
}) {
  const toneClass =
    tone === 'free'
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
      : tone === 'reserved'
        ? 'border-violet-300/20 bg-violet-400/10 text-violet-200'
        : 'border-orange-300/20 bg-orange-400/10 text-orange-200'
  const percent = total ? Math.round((value / total) * 100) : 0

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 border-r border-white/10 p-2 last:border-r-0">
      <span className={cn('flex h-14 w-14 items-center justify-center rounded-full border', toneClass)}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-300">{label}</p>
        <div className="mt-1 flex items-end gap-3">
          <p className="font-mono text-3xl font-black text-white">{String(value).padStart(2, '0')}</p>
          <p className="pb-1 text-sm text-slate-500">{percent}% do salao</p>
        </div>
      </div>
    </div>
  )
}

function TableStatusBadge({ status }: { status: TableStatus }) {
  return (
    <span
      className={cn(
        'rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em]',
        status === 'reserved'
          ? 'border-violet-300/30 bg-violet-400/10 text-violet-200'
          : isOccupiedStatus(status)
            ? 'border-orange-300/30 bg-orange-400/10 text-orange-200'
            : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
      )}
    >
      {tableStatusLabel(status)}
    </span>
  )
}

function TableStatusText({ status }: { status: TableStatus }) {
  return (
    <p
      className={cn(
        'mt-1 text-sm font-black',
        status === 'reserved'
          ? 'text-violet-200'
          : isOccupiedStatus(status)
            ? 'text-orange-200'
            : 'text-emerald-200',
      )}
    >
      {tableStatusLabel(status)}
    </p>
  )
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn('text-right text-slate-200', strong && 'font-mono text-lg font-black text-orange-300')}>
        {value}
      </span>
    </div>
  )
}

function PriceRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between', muted ? 'text-slate-500' : 'text-slate-300')}>
      <span>{label}</span>
      <span className="font-mono font-bold text-white">{formatCurrency(value)}</span>
    </div>
  )
}

function buildProductSections(
  products: Product[],
  categories: Category[],
  selectedCategoryId: string,
) {
  if (selectedCategoryId === 'featured') {
    return products.length
      ? [
          {
            id: 'featured',
            title: 'Destaques',
            products,
          },
        ]
      : []
  }

  if (selectedCategoryId !== 'all') {
    const category = categories.find((entry) => entry.id === selectedCategoryId)
    return products.length
      ? [
          {
            id: selectedCategoryId,
            title: category?.name ?? 'Categoria',
            products,
          },
        ]
      : []
  }

  const sections = categories
    .map((category) => ({
      id: category.id,
      title: category.name,
      products: products.filter((product) => product.categoryId === category.id),
    }))
    .filter((section) => section.products.length > 0)
  const uncategorized = products.filter(
    (product) => !categories.some((category) => category.id === product.categoryId),
  )

  return uncategorized.length
    ? [
        ...sections,
        {
          id: 'uncategorized',
          title: 'Outros itens',
          products: uncategorized,
        },
      ]
    : sections
}

function resolveCatalogChannel(channel: OrderChannel): ProductChannel {
  if (channel === 'dine_in') {
    return 'dine_in'
  }

  if (channel === 'counter' || channel === 'pickup') {
    return 'counter'
  }

  if (channel === 'digital_menu') {
    return 'digital_menu'
  }

  return 'delivery'
}

function getProductAvailability(product: Product, channel: ProductChannel) {
  return product.availability.find((entry) => entry.channel === channel)
}

function getProductPrice(product: Product, channel: ProductChannel) {
  return getProductAvailability(product, channel)?.priceOverride ?? product.price
}

function isProductOrderable(product: Product, channel: ProductChannel) {
  const availability = getProductAvailability(product, channel)
  return Boolean(product.active && availability?.visible && availability.available && !availability.soldOut)
}

function getProductStatus(product: Product, channel: ProductChannel) {
  const availability = getProductAvailability(product, channel)

  if (!product.active) {
    return 'Inativo'
  }

  if (!availability?.visible || !availability.available) {
    return 'Indisponivel'
  }

  if (availability.soldOut) {
    return 'Esgotado'
  }

  return 'Disponivel'
}

function buildDefaultOptionSelections(product: Product) {
  const selections: Record<string, string[]> = {}

  for (const group of product.optionGroups ?? []) {
    selections[group.id] = []
  }

  return selections
}

function buildSelectedCartOptions(
  product: Product,
  selections: Record<string, string[]>,
): OrderItemOption[] {
  return (product.optionGroups ?? []).flatMap((group) =>
    (selections[group.id] ?? []).flatMap((optionId) => {
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
}

function validateOptionSelections(product: Product, selections: Record<string, string[]>) {
  const errors: string[] = []

  for (const group of product.optionGroups ?? []) {
    const selected = selections[group.id] ?? []

    if (selected.length < group.minSelections) {
      errors.push(buildOptionMinimumMessage(product, group.name))
    }

    if (selected.length > group.maxSelections) {
      errors.push(buildOptionLimitMessage(product, group.maxSelections))
    }
  }

  return errors
}

function isOptionOrderable(option: { active: boolean; available: boolean; soldOut: boolean }) {
  return option.active && option.available && !option.soldOut
}

function buildOptionMinimumMessage(product: Product, groupName: string) {
  const productName = normalizeSearchText(product.name)
  const normalizedGroup = normalizeSearchText(groupName)

  if (productName.includes('pizza') && normalizedGroup.includes('sabor')) {
    return 'Escolha pelo menos 1 sabor para esta pizza.'
  }

  if (productName.includes('suco') && normalizedGroup.includes('sabor')) {
    return 'Escolha o sabor do suco.'
  }

  if (productName.includes('lasanha') && normalizedGroup.includes('sabor')) {
    return 'Escolha o sabor da lasanha.'
  }

  if (productName.includes('sorvete') && normalizedGroup.includes('sabor')) {
    return 'Escolha pelo menos 1 sabor.'
  }

  return `Escolha uma opcao em ${groupName}.`
}

function buildOptionLimitMessage(product: Product, maxSelections: number) {
  const productName = normalizeSearchText(product.name)

  if (productName.includes('pizza') || productName.includes('sorvete')) {
    return `Esse tamanho permite ate ${maxSelections} sabores.`
  }

  return `Esse item permite ate ${maxSelections} opcoes.`
}

function getOptionsTotal(options: OrderItemOption[]) {
  return options.reduce((sum, option) => sum + option.price * option.quantity, 0)
}

function getCartItemUnitTotal(item: { unitPrice: number; options: OrderItemOption[] }) {
  return item.unitPrice + getOptionsTotal(item.options)
}

function toOptionRequestItems(options: OrderItemOption[]) {
  return options.flatMap((option) =>
    option.groupId
      ? [
          {
            groupId: option.groupId,
            optionId: option.id,
            quantity: option.quantity,
          },
        ]
      : [],
  )
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function addressToText(address?: CustomerAddress | null) {
  if (!address) {
    return ''
  }

  return [
    `${address.street}, ${address.number}`,
    address.district,
    `${address.city} - ${address.state}`,
  ]
    .filter(Boolean)
    .join(' - ')
}

function parseAddressInput(value: string): CustomerAddressPayload | undefined {
  const raw = value.trim()

  if (!raw) {
    return undefined
  }

  const normalized = raw.replace(/\s+[–—]\s+/g, ' - ')
  const [streetBlock, districtBlock, cityBlock] = normalized.split(' - ').map((part) => part.trim())
  const [streetCandidate, numberCandidate] = streetBlock.split(',').map((part) => part.trim())
  const cityStateMatch = (cityBlock ?? districtBlock ?? '').match(/(.+?)(?:\s*-\s*|\s+)([A-Za-z]{2})$/)

  return {
    label: 'Principal',
    street: streetCandidate || raw,
    number: numberCandidate || 'S/N',
    district: districtBlock?.split(',')[0]?.trim() || 'Nao informado',
    city: cityStateMatch?.[1]?.trim() || 'Manaus',
    state: (cityStateMatch?.[2] ?? 'AM').toUpperCase(),
    reference: raw,
  }
}

function emptyCustomerForm(): CustomerFormState {
  return {
    name: '',
    phone: '',
    street: '',
    number: '',
    district: '',
    city: 'Manaus',
    state: 'AM',
    complement: '',
    reference: '',
    notes: '',
  }
}

function customerToForm(customer: Customer, addressId?: string): CustomerFormState {
  const address =
    customer.addresses.find((entry) => entry.id === addressId) ?? customer.addresses[0]

  return {
    name: customer.name,
    phone: customer.phone,
    street: address?.street ?? '',
    number: address?.number ?? '',
    district: address?.district ?? '',
    city: address?.city ?? 'Manaus',
    state: address?.state ?? 'AM',
    complement: address?.complement ?? '',
    reference: address?.reference ?? '',
    notes: customer.notes ?? '',
  }
}

function formToAddressPayload(form: CustomerFormState): CustomerAddressPayload | undefined {
  if (!form.street.trim() && !form.district.trim()) {
    return undefined
  }
  const fallback = parseAddressInput(formAddressToRawText(form))

  return {
    label: 'Principal',
    street: form.street.trim() || fallback?.street || 'Nao informado',
    number: form.number.trim() || fallback?.number || 'S/N',
    district: form.district.trim() || fallback?.district || 'Nao informado',
    complement: form.complement.trim() || undefined,
    city: form.city.trim() || fallback?.city || 'Manaus',
    state: (form.state.trim() || fallback?.state || 'AM').slice(0, 2).toUpperCase(),
    reference: form.reference.trim() || undefined,
  }
}

function formAddressToText(form: CustomerFormState) {
  const address = formToAddressPayload(form)

  return addressToText(address ? { id: 'form-address', ...address } : null)
}

function formAddressToRawText(form: CustomerFormState) {
  return [
    `${form.street}, ${form.number}`,
    form.district,
    `${form.city} - ${form.state}`,
  ]
    .filter((part) => part.replace(/[, -]/g, '').trim())
    .join(' - ')
}

function isCustomerSearchReady(value: string) {
  const trimmed = value.trim()
  const phoneDigits = normalizeWhatsAppNumber(trimmed)

  return trimmed.length >= 2 || phoneDigits.length >= 8
}

function formatCandidatePhone(value: string) {
  return normalizeWhatsAppNumber(value).length >= 8 ? formatWhatsAppNumber(value) : ''
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs)

    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debouncedValue
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function isTableFree(table: DiningTable) {
  return table.status === 'free' || table.status === 'closed'
}

function getDefaultGuestCount(table: DiningTable) {
  return Math.min(Math.max(table.capacity, 1), 2)
}

function isTableOccupied(table: DiningTable) {
  return isOccupiedStatus(table.status)
}

function isOccupiedStatus(status: TableStatus) {
  return status === 'occupied' || status === 'closing'
}

function tableStatusLabel(status: TableStatus) {
  if (status === 'reserved') {
    return 'Reservada'
  }

  if (status === 'closing') {
    return 'Fechamento'
  }

  if (status === 'occupied') {
    return 'Ocupada'
  }

  return 'Livre'
}

function formatElapsedTime(isoDate: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000))

  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return rest ? `${hours}h ${rest} min` : `${hours}h`
}

function buildEtaLabel(channel: OrderChannel, settings?: { estimatedPrepTimeMinutes?: number; estimatedDeliveryTimeMinutes?: number; estimatedDineInTimeMinutes?: number; estimatedCounterTimeMinutes?: number; estimatedPickupTimeMinutes?: number }) {
  if (channel === 'delivery') {
    const prep = settings?.estimatedPrepTimeMinutes ?? 25
    const delivery = settings?.estimatedDeliveryTimeMinutes ?? 20
    return `${prep + delivery} min`
  }

  if (channel === 'dine_in') {
    return `${settings?.estimatedDineInTimeMinutes ?? 18} min`
  }

  if (channel === 'pickup') {
    return `${settings?.estimatedPickupTimeMinutes ?? 20} min`
  }

  return `${settings?.estimatedCounterTimeMinutes ?? 15} min`
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  const tagName = element.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable
}
