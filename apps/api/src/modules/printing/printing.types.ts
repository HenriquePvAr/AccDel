import type { Prisma, PrintJobType } from '@prisma/client'

export interface PrintSnapshotOption {
  name: string
  quantity: number
}

export interface PrintSnapshotItem {
  productId: string | null
  name: string
  quantity: number
  notes: string | null
  options: PrintSnapshotOption[]
  unitPrice?: number
  totalPrice?: number
}

export interface PrintJobSnapshot {
  schemaVersion: 1
  jobId: string
  documentType: PrintJobType
  marker: 'ORIGINAL' | 'REIMPRESSAO'
  order: {
    id: string | null
    number: string
    createdAt: string
    serviceType: string
    tableCode: string | null
    priority: string
    notes: string | null
  }
  station: {
    id: string | null
    code: string | null
    name: string | null
  }
  items: PrintSnapshotItem[]
  financial?: {
    subtotal: number
    deliveryFee: number
    discount: number
    total: number
    paymentMethod: string
    paymentStatus: string
  }
  dispatch?: {
    customerName: string
    maskedPhone: string
    address: string | null
    addressReference: string | null
    paymentMethod: string
    amountToCollect: number
    driverName: string | null
  }
}

export interface PrintableOrderItem {
  productId: string | null
  name: string
  quantity: number
  unitPrice: number
  notes: string | null
  options: Prisma.JsonValue
}

export interface PrintableOrder {
  id: string
  number: string
  createdAt: Date
  serviceType: string
  tableCode: string | null
  priority: string
  notes: string | null
  customerName: string
  customerPhone: string
  addressText: string | null
  addressLabel: string | null
  paymentMethod: string
  paymentStatus: string
  subtotal: { toNumber(): number } | number
  deliveryFee: { toNumber(): number } | number
  discount: { toNumber(): number } | number
  total: { toNumber(): number } | number
  driver?: { name: string } | null
}

export interface AuthenticatedPrintAgent {
  id: string
  storeId: string
  name: string
  version: string | null
}
