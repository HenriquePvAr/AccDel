import type { Customer } from '@/types'

import type { ListResponse, PaginationParams } from '@/contracts/common'

export interface CustomersListFilters extends PaginationParams {
  q?: string
  search?: string
  phone?: string
}

export interface ListCustomersRequest {
  filters?: CustomersListFilters
}

export type CustomersListResponse = ListResponse<Customer>

export type CustomerSegment = 'new' | 'recurring' | 'vip' | 'inactive'

export interface CustomerMetricsSummary {
  totalCustomers: number
  segments: Record<CustomerSegment, number>
  totalSpent: number
  averageTicket: number
  averageFrequencyDays: number | null
  cancellations: number
  topNeighborhoods: {
    id: string
    label: string
    customers: number
    orders: number
    revenue: number
  }[]
}

export interface CustomerMetricsSummaryResponse {
  data: CustomerMetricsSummary
}

export interface CustomerDetailResponse {
  data: Customer | null
}

export interface CustomerAddressPayload {
  label: string
  street: string
  number: string
  district: string
  complement?: string
  city: string
  state: string
  reference?: string
}

export interface CreateCustomerRequest {
  name: string
  phone: string
  notes?: string
  address?: CustomerAddressPayload
}

export interface CreateCustomerResponse {
  data: Customer
}

export interface UpdateCustomerRequest {
  customerId: string
  name?: string
  phone?: string
  notes?: string
  address?: CustomerAddressPayload
}

export interface UpdateCustomerResponse {
  data: Customer
}
