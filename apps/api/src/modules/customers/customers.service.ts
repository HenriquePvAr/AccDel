import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import type {
  CreateCustomerPayload,
  ListCustomersQuery,
  UpdateCustomerPayload,
} from '@/contracts/customers.contract'
import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(query: ListCustomersQuery = {}) {
    const normalizedPhone = normalizePhone(query.phone)
    const q = query.q?.trim()
    const search = q || query.search?.trim()
    const qPhone = normalizePhone(q)
    const phoneSearch = normalizedPhone || qPhone
    const customers = await this.prisma.customer.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        ...(search && !qPhone
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: customerInclude,
      orderBy: {
        name: 'asc',
      },
      take: phoneSearch ? undefined : (query.pageSize ?? 20),
    })
    const filtered = phoneSearch
      ? customers.filter(
          (customer) =>
            phoneMatches(customer.phone, phoneSearch) ||
            customer.name.toLowerCase().includes(search?.toLowerCase() ?? ''),
        )
      : customers

    return buildListResponse(
      filtered.map(mapCustomer),
      filtered.length,
      query,
    )
  }

  async getCustomer(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId: DEFAULT_STORE_ID,
      },
      include: customerInclude,
    })

    if (!customer) {
      throw new NotFoundException('Cliente nao encontrado.')
    }

    return {
      data: mapCustomer(customer),
    }
  }

  async createCustomer(payload: CreateCustomerPayload) {
    const existing = await this.findCustomerByPhone(payload.phone)

    if (existing) {
      return {
        data: mapCustomer(existing),
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        name: payload.name,
        phone: formatPhoneForStorage(payload.phone),
        notes: normalizeNullableString(payload.notes),
        tags: [],
        ...(payload.address
          ? {
              addresses: {
                create: mapAddressPayload(payload.address),
              },
            }
          : {}),
      },
      include: customerInclude,
    })

    return {
      data: mapCustomer(customer),
    }
  }

  async updateCustomer(customerId: string, payload: UpdateCustomerPayload) {
    const current = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        addresses: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!current) {
      throw new NotFoundException('Cliente nao encontrado.')
    }

    const customer = await this.prisma.customer.update({
      where: {
        id: current.id,
      },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.phone ? { phone: formatPhoneForStorage(payload.phone) } : {}),
        ...(payload.notes !== undefined ? { notes: normalizeNullableString(payload.notes) } : {}),
        ...(payload.address
          ? {
              addresses: current.addresses[0]
                ? {
                    update: {
                      where: {
                        id: current.addresses[0].id,
                      },
                      data: mapAddressPayload(payload.address),
                    },
                  }
                : {
                    create: mapAddressPayload(payload.address),
                  },
            }
          : {}),
      },
      include: customerInclude,
    })

    return {
      data: mapCustomer(customer),
    }
  }

  private async findCustomerByPhone(phone: string) {
    const normalizedPhone = normalizePhone(phone)
    const customers = await this.prisma.customer.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
      include: customerInclude,
    })

    return customers.find((customer) => normalizePhone(customer.phone) === normalizedPhone) ?? null
  }
}

const customerInclude = {
  addresses: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  orders: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 3,
    include: {
      items: true,
    },
  },
} satisfies Prisma.CustomerInclude

type CustomerRecord = Prisma.CustomerGetPayload<{
  include: typeof customerInclude
}>

function mapCustomer(customer: CustomerRecord) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    notes: customer.notes ?? undefined,
    tags: customer.tags,
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      street: address.street,
      number: address.number,
      district: address.district,
      complement: address.complement ?? undefined,
      city: address.city,
      state: address.state,
      reference: address.reference ?? undefined,
    })),
    lastOrders: customer.orders.map((order) => ({
      id: order.id,
      number: order.number,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      items: order.items.slice(0, 3).map((item) => item.name),
    })),
  }
}

function mapAddressPayload(address: NonNullable<CreateCustomerPayload['address']>) {
  return {
    label: address.label,
    street: address.street,
    number: address.number,
    district: address.district,
    complement: normalizeNullableString(address.complement),
    city: address.city,
    state: address.state.toUpperCase(),
    reference: normalizeNullableString(address.reference),
  }
}

function normalizeNullableString(value?: string) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/\D/g, '') ?? ''
}

function phoneMatches(phone: string, normalizedSearch: string) {
  const normalizedPhone = normalizePhone(phone)
  const searchWithoutCountryCode =
    normalizedSearch.startsWith('55') && normalizedSearch.length > 11
      ? normalizedSearch.slice(2)
      : normalizedSearch

  return (
    normalizedPhone.includes(normalizedSearch) ||
    normalizedPhone.endsWith(searchWithoutCountryCode) ||
    normalizedPhone.slice(-8).includes(searchWithoutCountryCode.slice(-8))
  )
}

function formatPhoneForStorage(value: string) {
  const digits = normalizePhone(value)
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }

  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }

  return value.trim()
}
