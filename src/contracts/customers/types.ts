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
