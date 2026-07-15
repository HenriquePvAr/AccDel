import type { PaymentMethod } from '@prisma/client'

export interface AiToolContext {
  storeId: string
  conversationId: string
  accountId: string
  customerId: string | null
  inboundEventId: string
  inboundExternalId: string
  explicitlyConfirmed: boolean
}

export interface DraftItem {
  productId: string
  quantity: number
  notes?: string
  options: Array<{
    groupId: string
    optionId: string
    quantity: number
  }>
}

export interface DraftMetadata {
  serviceType: 'delivery' | 'pickup'
  addressId?: string
  paymentMethod?: PaymentMethod
}
