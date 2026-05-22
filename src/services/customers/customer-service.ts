import type {
  CreateCustomerRequest,
  CreateCustomerResponse,
  CustomerDetailResponse,
  CustomersListResponse,
  ListCustomersRequest,
  UpdateCustomerRequest,
  UpdateCustomerResponse,
} from '@/contracts'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import { buildListResponse } from '@/services/adapters/list-response'
import { apiClient, buildQueryString, shouldUseApi } from '@/services/http/api-client'
import { simulateAsync } from '@/services/utils'
import type { Customer } from '@/types'

export const customerService = {
  async listCustomers(request?: ListCustomersRequest): Promise<CustomersListResponse> {
    if (shouldUseApi) {
      const filters = request?.filters ?? {}
      const endpoint = filters.q ? '/customers/search' : '/customers'
      return apiClient.get<CustomersListResponse>(
        `${endpoint}${buildQueryString(filters)}`,
      )
    }

    const filters = request?.filters
    const phone = normalizePhone(filters?.phone)
    const search = (filters?.q ?? filters?.search)?.trim().toLowerCase()
    const searchPhone = phone || normalizePhone(filters?.q)
    const customers = getDemoDatabase().customers.filter((customer) => {
      const matchesSearch =
        !search ||
        customer.name.toLowerCase().includes(search) ||
        customer.phone.toLowerCase().includes(search) ||
        (searchPhone ? phoneMatches(customer.phone, searchPhone) : false) ||
        (customer.notes?.toLowerCase().includes(search) ?? false)
      const matchesPhone = !searchPhone || phoneMatches(customer.phone, searchPhone)

      return matchesSearch && matchesPhone
    })

    return simulateAsync(buildListResponse(customers, filters))
  },

  async createCustomer(request: CreateCustomerRequest): Promise<CreateCustomerResponse> {
    if (shouldUseApi) {
      return apiClient.post<CreateCustomerResponse, CreateCustomerRequest>('/customers', request)
    }

    const normalizedPhone = normalizePhone(request.phone)
    const nextDb = mutateDemoDatabase((database) => {
      const existing = database.customers.find(
        (customer) => normalizePhone(customer.phone) === normalizedPhone,
      )

      if (existing) {
        return database
      }

      database.customers.unshift({
        id: crypto.randomUUID(),
        name: request.name,
        phone: request.phone,
        notes: request.notes,
        tags: [],
        addresses: request.address
          ? [
              {
                id: crypto.randomUUID(),
                ...request.address,
              },
            ]
          : [],
      })

      return database
    })
    const saved = nextDb.customers.find(
      (customer) => normalizePhone(customer.phone) === normalizedPhone,
    )

    return simulateAsync({ data: saved ?? nextDb.customers[0] })
  },

  async updateCustomer(request: UpdateCustomerRequest): Promise<UpdateCustomerResponse> {
    const payload = {
      name: request.name,
      phone: request.phone,
      address: request.address,
    }

    if (shouldUseApi) {
      return apiClient.patch<UpdateCustomerResponse, typeof payload>(
        `/customers/${request.customerId}`,
        payload,
      )
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.customers = database.customers.map((customer) => {
        if (customer.id !== request.customerId) {
          return customer
        }

        const nextAddresses = request.address
          ? [
              {
                id: customer.addresses[0]?.id ?? crypto.randomUUID(),
                ...request.address,
              },
              ...customer.addresses.slice(1),
            ]
          : customer.addresses

        return {
          ...customer,
          name: request.name ?? customer.name,
          phone: request.phone ?? customer.phone,
          notes: request.notes ?? customer.notes,
          addresses: nextAddresses,
        }
      })

      return database
    })
    const saved = nextDb.customers.find((customer) => customer.id === request.customerId)

    return simulateAsync({ data: saved ?? emptyCustomer(request.customerId) })
  },

  async getCustomer(customerId: string): Promise<CustomerDetailResponse> {
    if (shouldUseApi) {
      return apiClient.get<CustomerDetailResponse>(`/customers/${customerId}`)
    }

    return simulateAsync({
      data: getDemoDatabase().customers.find((customer) => customer.id === customerId) ?? null,
    })
  },
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/\D/g, '') ?? ''
}

function phoneMatches(phone: string, normalizedSearch: string) {
  const normalizedPhone = normalizePhone(phone)
  const localSearch =
    normalizedSearch.startsWith('55') && normalizedSearch.length > 11
      ? normalizedSearch.slice(2)
      : normalizedSearch

  return (
    normalizedPhone.includes(normalizedSearch) ||
    normalizedPhone.endsWith(localSearch) ||
    normalizedPhone.slice(-8).includes(localSearch.slice(-8))
  )
}

function emptyCustomer(customerId: string): Customer {
  return {
    id: customerId,
    name: 'Cliente nao encontrado',
    phone: '',
    tags: [],
    addresses: [],
  }
}
