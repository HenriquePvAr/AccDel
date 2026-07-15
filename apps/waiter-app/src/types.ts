export type UserRole = 'waiter' | 'manager'
export type TableStatus = 'free' | 'occupied' | 'reserved' | 'closing' | 'closed'
export type ProductionStatus =
  | 'in_analysis'
  | 'in_preparation'
  | 'ready'
  | 'completed'
  | 'cancelled'
export type PrintStatus = 'not_required' | 'pending' | 'confirmed' | 'failed' | 'unknown'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  initials: string
  permissions: string[]
  store: { id: string; name: string; tradeName: string }
}

export interface WaiterProfile {
  id: string
  name: string
  email: string
  role: UserRole
  operationalStatus: 'available' | 'serving' | 'paused'
  tablesServed: number
  totalOrders: number
  lastActivityAt?: string
  store: { id: string; tradeName: string; name: string }
}

export interface DiningArea {
  id: string
  name: string
  color: string
  sortOrder: number
}

export interface DiningTable {
  id: string
  code: string
  areaId: string
  areaName: string
  capacity: number
  status: TableStatus
  guests?: number
  waiterId?: string
  waiterName?: string
  currentSessionId?: string
  version: number
  notes?: string
}

export interface SessionItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  options: Array<Record<string, unknown>>
  createdAt: string
  createdByName?: string
  productionOrderId?: string
  productionOrderNumber?: string
  productionStatus?: ProductionStatus
  printStatus: PrintStatus
  cancelledAt?: string
  cancelReason?: string
  deliveredAt?: string
}

export interface TableSession {
  id: string
  tableId: string
  tableCode: string
  waiterId?: string
  waiterName?: string
  openedAt: string
  closedAt?: string
  guestCount: number
  subtotal: number
  discount: number
  serviceFee: number
  total: number
  status: 'open' | 'awaiting_close' | 'closed'
  version: number
  notes?: string
  items: SessionItem[]
  timeline: Array<{ id: string; label: string; actor: string; at: string }>
}

export interface RoomSnapshot {
  areas: DiningArea[]
  tables: DiningTable[]
  sessions: TableSession[]
}

export interface MenuOption {
  id: string
  name: string
  description?: string
  priceDelta: number
  orderable: boolean
}

export interface MenuOptionGroup {
  id: string
  name: string
  description?: string
  required: boolean
  minSelections: number
  maxSelections: number
  options: MenuOption[]
}

export interface MenuProduct {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image?: string
  featured: boolean
  orderable: boolean
  unavailableReason?: string
  optionGroups: MenuOptionGroup[]
}

export interface WaiterMenu {
  generatedAt: string
  store: { id: string; name: string }
  categories: Array<{
    id: string
    name: string
    description: string
    color?: string
    sortOrder: number
    available: boolean
    products: MenuProduct[]
  }>
}

export interface TableDetail {
  table: DiningTable
  session: TableSession | null
}

export interface DraftSelection {
  groupId: string
  optionId: string
  quantity: number
}

export interface DraftItem {
  clientId: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
  options: DraftSelection[]
  optionLabels: string[]
}
