export type UserRole =
  | 'owner'
  | 'manager'
  | 'attendant'
  | 'cashier'
  | 'kitchen'
  | 'waiter'
  | 'driver'
  | 'supervisor'

export type UserStatus = 'active' | 'inactive'

export type AdminPermission =
  | 'dashboard:view'
  | 'orders:view'
  | 'orders:create'
  | 'orders:update'
  | 'dining:view'
  | 'dining:update'
  | 'kitchen:view'
  | 'kitchen:update'
  | 'drivers:view'
  | 'drivers:self'
  | 'catalog:categories:view'
  | 'catalog:categories:manage'
  | 'catalog:products:view'
  | 'catalog:products:manage'
  | 'catalog:promotions:view'
  | 'catalog:promotions:manage'
  | 'catalog:coupons:view'
  | 'catalog:coupons:manage'
  | 'catalog:preview:view'
  | 'cash:view'
  | 'cash:manage'
  | 'payments:confirm'
  | 'history:view'
  | 'reports:view'
  | 'settings:store:view'
  | 'settings:store:manage'
  | 'settings:delivery:view'
  | 'settings:delivery:manage'
  | 'settings:preferences:view'
  | 'settings:preferences:manage'
  | 'users:view'
  | 'users:manage'
  | 'ai_attendant:view'
  | 'ai_attendant:manage'
  | 'printing:view'
  | 'printing:manage'
  | 'printing:reprint'
  | 'waiter:tables:view'
  | 'waiter:sessions:create'
  | 'waiter:orders:create'
  | 'waiter:orders:update'
  | 'waiter:orders:send'
  | 'waiter:orders:cancel_item'
  | 'waiter:items:deliver'
  | 'waiter:sessions:close_request'
  | 'waiter:tables:transfer'

export type OrderStatus =
  | 'in_analysis'
  | 'in_preparation'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'

export type OrderChannel =
  | 'delivery'
  | 'dine_in'
  | 'counter'
  | 'pickup'
  | 'digital_menu'
  | 'whatsapp'

export type PaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'meal_voucher'
  | 'payment_link'

export type PaymentProvider = 'manual' | 'pix' | 'picpay'
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'cancelled' | 'refunded'
export type PriorityLevel = 'normal' | 'priority' | 'vip'
export type TableStatus = 'free' | 'occupied' | 'reserved' | 'closing' | 'closed'
export type ProductChannel = 'dine_in' | 'delivery' | 'digital_menu' | 'counter'
export type DriverConnectionStatus = 'online' | 'offline'
export type DriverAvailabilityStatus = 'available' | 'delivering' | 'paused'
export type WaiterStatus = 'available' | 'serving' | 'paused'
export type CashMovementType =
  | 'sale'
  | 'withdrawal'
  | 'supply'
  | 'adjustment'
  | 'refund'
  | 'OPENING_BALANCE'
  | 'CASH_SALE'
  | 'CASH_SUPPLY'
  | 'CASH_WITHDRAWAL'
  | 'CASH_REFUND'
  | 'CASH_ADJUSTMENT'
  | 'CLOSING_DIFFERENCE'

export interface StoreProfile {
  id: string
  name: string
  tradeName: string
  timezone: string
  city: string
  state: string
  logoUrl?: string | null
  phone?: string | null
  publicWhatsapp?: string | null
  addressLine?: string | null
  neighborhood?: string | null
  businessHours?: string | null
  businessDays?: string[]
  greetingMessage?: string | null
  outOfHoursMessage?: string | null
  cancellationPolicy?: string | null
  generalNotes?: string | null
  brandAccent: string
  autoAcceptEnabled: boolean
  defaultDeliveryFee?: number
  minimumOrderAmount?: number
  deliveryEnabled?: boolean
  pickupEnabled?: boolean
  counterEnabled?: boolean
  dineInEnabled?: boolean
  digitalMenuEnabled?: boolean
  whatsappAiEnabled?: boolean
  estimatedPrepTimeMinutes?: number
  estimatedDeliveryTimeMinutes?: number
  estimatedDineInTimeMinutes?: number
  estimatedCounterTimeMinutes?: number
  estimatedPickupTimeMinutes?: number
}

export interface PaymentMethodConfig {
  id: string
  name: string
  method?: PaymentMethod
  provider: PaymentProvider
  active: boolean
  fixed: boolean
  requiresReceipt: boolean
  autoCashEntry: boolean
  channels: ProductChannel[]
  sortOrder: number
  externalEnabled: boolean
  externalPaymentId?: string
  qrCodePayload?: string
  qrCodeUrl?: string
  createdAt?: string
  updatedAt?: string
}

export interface AppUser {
  id: string
  name: string
  role: UserRole
  initials: string
  online: boolean
}

export interface AuthenticatedAdminUser {
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  initials: string
  permissions: AdminPermission[]
  store: Pick<StoreProfile, 'id' | 'name' | 'tradeName'>
}

export interface CustomerAddress {
  id: string
  label: string
  street: string
  number: string
  district: string
  complement?: string
  city: string
  state: string
  reference?: string
}

export interface CustomerLastOrderSummary {
  id: string
  number: string
  total: number
  createdAt: string
  items: string[]
}

export interface CustomerCrmSummary {
  orderCount: number
  completedOrders: number
  cancelledOrders: number
  totalSpent: number
  averageTicket: number
  frequencyDays: number | null
  lastOrderAt?: string
  segment: 'new' | 'recurring' | 'vip' | 'inactive'
  favoriteItems: string[]
}

export interface Customer {
  id: string
  name: string
  phone: string
  notes?: string
  tags: string[]
  addresses: CustomerAddress[]
  lastOrders?: CustomerLastOrderSummary[]
  crm?: CustomerCrmSummary
}

export interface OrderItemOption {
  id: string
  groupId?: string
  groupName?: string
  name: string
  quantity: number
  price: number
}

export interface OrderItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
  options: OrderItemOption[]
  cancelledAt?: string
  cancelReason?: string
}

export interface TimelineEntry {
  id: string
  label: string
  at: string
  actor: string
}

export interface OrderDriverSummary {
  id: string
  name: string
  phone: string
}

export interface OrderDiscountBreakdown {
  promotionName?: string
  promotionDiscount?: number
  couponCode?: string
  couponDiscount?: number
  subtotalBeforeDiscount?: number
}

export interface Order {
  id: string
  number: string
  customerId: string
  customerName: string
  customerPhone: string
  source: OrderChannel
  serviceType: OrderChannel
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  total: number
  subtotal: number
  deliveryFee: number
  discount: number
  couponCode?: string
  promotionName?: string
  discountBreakdown?: OrderDiscountBreakdown
  createdAt: string
  dueAt: string
  estimatedPrepTimeMinutes?: number
  estimatedDeliveryTimeMinutes?: number
  estimatedTotalTimeMinutes?: number
  priority: PriorityLevel
  delayed: boolean
  tags: string[]
  addressLabel?: string
  addressText?: string
  tableCode?: string
  notes?: string
  driverId?: string
  driver?: OrderDriverSummary
  items: OrderItem[]
  timeline: TimelineEntry[]
}

export interface DiningArea {
  id: string
  name: string
  color: string
  sortOrder?: number
}

export interface DiningTable {
  id: string
  code: string
  areaId: string
  areaName?: string
  capacity: number
  status: TableStatus
  guests?: number
  waiterId?: string
  waiterName?: string
  currentSessionId?: string
  notes?: string
}

export interface TableSessionItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  options: OrderItemOption[]
  createdAt?: string
  createdByName?: string
}

export interface TableSession {
  id: string
  tableId: string
  tableCode?: string
  waiterId?: string
  waiterName?: string
  openedAt: string
  closedAt?: string
  guestCount: number
  subtotal: number
  discount: number
  serviceFee: number
  total: number
  paymentMethod?: PaymentMethod
  status: 'open' | 'awaiting_close' | 'closed'
  notes?: string
  items: TableSessionItem[]
  timeline: TimelineEntry[]
}

export interface ChannelAvailability {
  channel: ProductChannel
  available: boolean
  visible: boolean
  soldOut: boolean
  priceOverride?: number
}

export interface ProductOption {
  id: string
  name: string
  description?: string
  image?: string
  priceDelta: number
  active: boolean
  available: boolean
  soldOut: boolean
  sortOrder: number
  orderable?: boolean
}

export interface ProductOptionGroup {
  id: string
  name: string
  description?: string
  required: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
  autoApplied?: boolean
  options: ProductOption[]
}

export interface Product {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string
  featured: boolean
  active: boolean
  preparationStation: string
  sortOrder: number
  availability: ChannelAvailability[]
  optionGroups?: ProductOptionGroup[]
  tags: string[]
}

export interface Category {
  id: string
  name: string
  description: string
  active: boolean
  icon?: string
  color?: string
  visibleOnPos: boolean
  visibleOnDigitalMenu: boolean
  sortOrder: number
  productCount?: number
}

export interface Promotion {
  id: string
  name: string
  description?: string
  type: 'percent' | 'fixed' | 'combo'
  discountValue?: number
  rules?: PromotionRules
  channels: ProductChannel[]
  productIds: string[]
  categoryIds: string[]
  startsAt?: string
  endsAt?: string
  status: 'active' | 'inactive' | 'scheduled' | 'expired'
  createdAt?: string
  updatedAt?: string
}

export interface PromotionRules {
  requiredItems: number
  participantType: 'category' | 'product'
  participantId?: string
  sizeLabel?: string
  flavorLimitPerItem?: number
  finalPrice?: number
  notes?: string
}

export interface Coupon {
  id: string
  code: string
  description?: string
  type: 'percent' | 'fixed'
  value: number
  minOrderAmount: number
  maxUses?: number
  channels: ProductChannel[]
  validFrom?: string
  validUntil?: string
  uses: number
  status: 'active' | 'inactive' | 'scheduled' | 'expired'
  createdAt?: string
  updatedAt?: string
}

export interface CatalogOptionGroupCategoryLink {
  categoryId: string
  required: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
  description?: string
  autoApply: boolean
}

export interface CatalogOptionGroupProductLink {
  productId: string
  required: boolean
  minSelections: number
  maxSelections: number
  sortOrder: number
  description?: string
  autoApplied: boolean
}

export interface CatalogOptionGroup {
  id: string
  name: string
  description?: string
  sortOrder: number
  options: ProductOption[]
  categoryLinks: CatalogOptionGroupCategoryLink[]
  productLinks: CatalogOptionGroupProductLink[]
}

export interface CatalogMenuProduct {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  basePrice: number
  image: string
  featured: boolean
  active: boolean
  preparationStation: string
  sortOrder: number
  tags: string[]
  channelAvailability: ChannelAvailability | null
  orderable: boolean
  unavailableReason: string | null
  optionGroups: ProductOptionGroup[]
}

export interface CatalogMenuCategory {
  id: string
  name: string
  description: string
  active: boolean
  icon?: string
  color?: string
  visibleOnPos: boolean
  visibleOnDigitalMenu: boolean
  sortOrder: number
  visibleForChannel: boolean
  products: CatalogMenuProduct[]
  optionGroupLinks: Array<
    CatalogOptionGroupCategoryLink & {
      groupId: string
      groupName: string
      options: ProductOption[]
    }
  >
}

export interface CatalogMenuSource {
  store: Pick<
    StoreProfile,
    | 'id'
    | 'name'
    | 'tradeName'
    | 'logoUrl'
    | 'phone'
    | 'publicWhatsapp'
    | 'addressLine'
    | 'city'
    | 'state'
    | 'neighborhood'
    | 'timezone'
    | 'businessHours'
    | 'businessDays'
    | 'greetingMessage'
    | 'outOfHoursMessage'
    | 'cancellationPolicy'
    | 'generalNotes'
    | 'defaultDeliveryFee'
    | 'minimumOrderAmount'
    | 'deliveryEnabled'
    | 'pickupEnabled'
    | 'counterEnabled'
    | 'dineInEnabled'
    | 'digitalMenuEnabled'
    | 'whatsappAiEnabled'
    | 'estimatedPrepTimeMinutes'
    | 'estimatedDeliveryTimeMinutes'
    | 'estimatedDineInTimeMinutes'
    | 'estimatedCounterTimeMinutes'
    | 'estimatedPickupTimeMinutes'
  >
  channel: ProductChannel
  includeUnavailable: boolean
  generatedAt: string
  categories: CatalogMenuCategory[]
  promotions: Promotion[]
  coupons: Coupon[]
  optionGroups: CatalogOptionGroup[]
  checkout: {
    channels: {
      deliveryEnabled: boolean
      pickupEnabled: boolean
      digitalMenuEnabled: boolean
      minimumOrderAmount: number
    }
    paymentMethods: PublicCheckoutPaymentMethod[]
    delivery: PublicDeliveryCheckoutConfig
  }
}

export interface PublicCheckoutPaymentMethod {
  id: string
  name: string
  method?: PaymentMethod
  provider: PaymentProvider
  requiresReceipt: boolean
  availableForCheckout: boolean
  unavailableReason?: string | null
}

export interface PublicDeliveryNeighborhood {
  id: string
  neighborhood: string
  fee: number
  active: boolean
  estimatedDeliveryTimeMinutes?: number
}

export interface PublicDeliveryCheckoutConfig {
  defaultFee: number
  requiresKnownNeighborhood: boolean
  neighborhoods: PublicDeliveryNeighborhood[]
}

export interface DeliveryStop {
  id?: string
  orderId: string
  orderNumber: string
  customerName: string
  addressLabel: string
  plannedSequence: number
  finalSequence: number
  actualSequence?: number
  etaMinutes: number
  distanceMeters?: number
  latitude?: number
  longitude?: number
  status?: OrderStatus
}

export interface Driver {
  id: string
  name: string
  email?: string
  phone: string
  vehicle: string
  active?: boolean
  connectionStatus: DriverConnectionStatus
  availability: DriverAvailabilityStatus
  currentOrderId?: string
  averageDeliveryMinutes: number
  distanceKmToday: number
  totalDeliveries?: number
  completedOrders?: number
  cancelledOrders?: number
  totalAssignedRevenue?: number
  lastActivityAt?: string
  queue: DeliveryStop[]
  history?: Array<{
    id: string
    orderNumber: string
    status: OrderStatus
    total: number
    createdAt: string
  }>
}

export interface Waiter {
  id: string
  name: string
  email?: string
  phone: string
  active: boolean
  status: WaiterStatus
  totalOrders: number
  totalSales: number
  tablesServed: number
  cancellations: number
  averageTicket: number
  lastActivityAt?: string
  history: Array<{
    id: string
    label: string
    createdAt: string
    value?: number
  }>
}

export interface DriverLocation {
  id: string
  driverId: string
  orderId?: string
  assignmentId?: string
  x: number
  y: number
  longitude?: number
  latitude?: number
  accuracyMeters?: number
  heading: number
  speedKmh: number
  capturedAt: string
  source?: 'gps' | 'app' | 'admin' | 'simulator' | 'fallback'
  isActive?: boolean
}

export interface GeoCoordinate {
  longitude: number
  latitude: number
}

export interface DriverRoute {
  driverId: string
  driverName: string
  storeLocation: GeoCoordinate
  currentLocation: DriverLocation | null
  stops: DeliveryStop[]
  geometry: GeoCoordinate[]
  etaMinutes: number
  durationSeconds: number
  distanceMeters: number
  provider: 'osrm' | 'valhalla' | 'fallback'
  updatedAt: string
}

export interface OrderTracking {
  orderId: string
  orderNumber: string
  status: OrderStatus
  message: string
  etaMinutes: number
  provider: 'osrm' | 'valhalla' | 'fallback'
  driver: OrderDriverSummary | null
  driverLocation: {
    latitude: number
    longitude: number
    capturedAt: string
    speedKmh: number
  } | null
  updatedAt: string
}

export interface CashMovement {
  id: string
  type: CashMovementType
  method: PaymentMethod | 'internal'
  amount: number
  label: string
  reason?: string | null
  balanceBefore?: number
  balanceAfter?: number
  originalMovementId?: string | null
  createdAt: string
  userName: string
  approvedByName?: string | null
}

export interface CashTerminal {
  id: string
  code: string
  name: string
}

export interface CashRegister {
  id: string
  status: 'open' | 'closing' | 'closed'
  openedAt: string
  closedAt?: string | null
  terminal?: CashTerminal | null
  operatorName: string
  openedByName?: string | null
  closedByName?: string | null
  openingNote?: string | null
  closingNote?: string | null
  differenceReason?: string | null
  openingAmount: number
  expectedAmount: number
  countedAmount: number
  differenceAmount: number
  entriesByMethod: Record<PaymentMethod, number>
  movements: CashMovement[]
}

export interface MetricCardData {
  id: string
  label: string
  value: string
  trendLabel: string
  trendDirection: 'up' | 'down' | 'neutral'
}

export interface ReportPoint {
  label: string
  revenue: number
  orders: number
  averageTicket: number
}

export interface ChannelBreakdown {
  label: string
  revenue: number
  orders: number
}

export interface ReportTableRow {
  id: string
  label: string
  revenue: number
  orders: number
  share: number
}

export interface PaymentBreakdownRow {
  label: string
  revenue: number
  orders: number
}

export interface OrdersByStatusRow {
  id: string
  label: string
  orders: number
}

export interface CancellationSummaryRow {
  id: string
  orderNumber: string
  customerName: string
  note: string
  value: number
}

export interface PerformanceSummaryRow {
  id: string
  name: string
  primary: string
  secondary: string
  value: number
}

export interface TablesSummary {
  free: number
  occupied: number
  reserved: number
  closing: number
  openSessions: number
  closedSessions: number
  diningRevenue: number
}

export interface ReportsSnapshot {
  metrics: MetricCardData[]
  revenueSeries: ReportPoint[]
  byChannel: ChannelBreakdown[]
  byPayment: PaymentBreakdownRow[]
  ordersByStatus: OrdersByStatusRow[]
  topProducts: ReportTableRow[]
  topCategories: ReportTableRow[]
  topOptions: ReportTableRow[]
  topNeighborhoods: ReportTableRow[]
  aiSummary: {
    orderDraftsSuggested: number
    orderDraftsConverted: number
    transfersToHuman: number
    conversionRate: number
  }
  timeSummary: {
    averagePreparationMinutes: number | null
    averageDeliveryMinutes: number | null
  }
  cancellations: CancellationSummaryRow[]
  driverSummaries: PerformanceSummaryRow[]
  waiterSummaries: PerformanceSummaryRow[]
  tablesSummary: TablesSummary
}

export interface PreviewCartItem {
  id: string
  productId: string
  name: string
  quantity: number
  price: number
}
