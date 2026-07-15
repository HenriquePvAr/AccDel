import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import type {
  CreateCustomerPayload,
  CustomerSegment,
  ListCustomersQuery,
  UpdateCustomerPayload,
} from '@/contracts/customers.contract'
import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

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
        storeId: getCurrentStoreId(),
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

    const metricsByCustomerId = await this.buildCustomerMetrics(filtered.map((customer) => customer.id))

    return buildListResponse(
      filtered.map((customer) => mapCustomer(customer, metricsByCustomerId.get(customer.id))),
      filtered.length,
      query,
    )
  }

  async getCustomer(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId: getCurrentStoreId(),
      },
      include: customerInclude,
    })

    if (!customer) {
      throw new NotFoundException('Cliente nao encontrado.')
    }

    const metricsByCustomerId = await this.buildCustomerMetrics([customer.id])

    return {
      data: mapCustomer(customer, metricsByCustomerId.get(customer.id)),
    }
  }

  async getMetricsSummary() {
    const customers = await this.prisma.customer.findMany({
      where: {
        storeId: getCurrentStoreId(),
      },
      include: {
        addresses: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        orders: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            items: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    const segments: Record<CustomerSegment, number> = {
      inactive: 0,
      new: 0,
      recurring: 0,
      vip: 0,
    }
    const neighborhoodTotals = new Map<
      string,
      {
        id: string
        label: string
        customers: number
        orders: number
        revenue: number
      }
    >()
    const crmSummaries = customers.map((customer) => {
      const crm = buildCrmSummary(customer.orders)
      segments[crm.segment] += 1

      const district = customer.addresses[0]?.district?.trim()
      if (district) {
        const id = normalizeKey(district)
        const completedOrders = customer.orders.filter((order) => order.status === 'completed')
        const activeOrders = customer.orders.filter((order) => order.status !== 'cancelled')
        const current = neighborhoodTotals.get(id) ?? {
          id,
          label: district,
          customers: 0,
          orders: 0,
          revenue: 0,
        }

        current.customers += 1
        current.orders += activeOrders.length
        current.revenue = roundMoney(
          current.revenue +
            completedOrders.reduce((sum, order) => sum + Number(order.total), 0),
        )
        neighborhoodTotals.set(id, current)
      }

      return crm
    })
    const completedOrders = customers.flatMap((customer) =>
      customer.orders.filter((order) => order.status === 'completed'),
    )
    const totalSpent = roundMoney(
      completedOrders.reduce((sum, order) => sum + Number(order.total), 0),
    )
    const frequencyValues = crmSummaries
      .map((crm) => crm.frequencyDays)
      .filter((value): value is number => value !== null)

    return {
      data: {
        totalCustomers: customers.length,
        segments,
        totalSpent,
        averageTicket: completedOrders.length
          ? roundMoney(totalSpent / completedOrders.length)
          : 0,
        averageFrequencyDays: average(frequencyValues),
        cancellations: crmSummaries.reduce((sum, crm) => sum + crm.cancelledOrders, 0),
        topNeighborhoods: [...neighborhoodTotals.values()]
          .sort((left, right) => right.orders - left.orders || right.revenue - left.revenue)
          .slice(0, 8),
      },
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
        storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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

  async saveWhatsappDeliveryAddress(
    customerId: string,
    input:
      | { addressId: string }
      | {
          label: string
          street: string
          number: string
          district: string
          complement?: string
          city: string
          state: string
          reference?: string
        },
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId: getCurrentStoreId() },
      include: { addresses: true },
    })
    if (!customer) throw new NotFoundException('Cliente nao encontrado.')

    if ('addressId' in input) {
      const existing = customer.addresses.find((address) => address.id === input.addressId)
      if (!existing) throw new NotFoundException('Endereco nao pertence ao cliente.')
      return { data: { id: existing.id, label: existing.label } }
    }

    const matching = customer.addresses.find(
      (address) =>
        address.street.toLowerCase() === input.street.toLowerCase() &&
        address.number.toLowerCase() === input.number.toLowerCase() &&
        address.district.toLowerCase() === input.district.toLowerCase(),
    )
    if (matching) return { data: { id: matching.id, label: matching.label } }

    const created = await this.prisma.customerAddress.create({
      data: {
        customerId,
        label: input.label,
        street: input.street,
        number: input.number,
        district: input.district,
        complement: input.complement,
        city: input.city,
        state: input.state.toUpperCase(),
        reference: input.reference,
      },
    })
    return { data: { id: created.id, label: created.label } }
  }

  private async findCustomerByPhone(phone: string) {
    const normalizedPhone = normalizePhone(phone)
    const customers = await this.prisma.customer.findMany({
      where: {
        storeId: getCurrentStoreId(),
      },
      include: customerInclude,
    })

    return customers.find((customer) => normalizePhone(customer.phone) === normalizedPhone) ?? null
  }

  private async buildCustomerMetrics(customerIds: string[]) {
    if (!customerIds.length) {
      return new Map<string, CustomerCrmSummary>()
    }

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: getCurrentStoreId(),
        customerId: {
          in: customerIds,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    const metrics = new Map<string, CustomerCrmSummary>()

    for (const customerId of customerIds) {
      const customerOrders = orders.filter((order) => order.customerId === customerId)
      metrics.set(customerId, buildCrmSummary(customerOrders))
    }

    return metrics
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

interface CustomerCrmSummary {
  orderCount: number
  completedOrders: number
  cancelledOrders: number
  totalSpent: number
  averageTicket: number
  frequencyDays: number | null
  lastOrderAt?: string
  segment: CustomerSegment
  favoriteItems: string[]
}

function mapCustomer(customer: CustomerRecord, crm?: CustomerCrmSummary) {
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
    crm,
  }
}

function buildCrmSummary(
  orders: Array<
    Prisma.OrderGetPayload<{
      include: {
        items: true
      }
    }>
  >,
): CustomerCrmSummary {
  const activeOrders = orders.filter((order) => order.status !== 'cancelled')
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled')
  const totalSpent = roundMoney(
    completedOrders.reduce((sum, order) => sum + Number(order.total), 0),
  )
  const averageTicket = completedOrders.length
    ? roundMoney(totalSpent / completedOrders.length)
    : 0
  const sortedCompleted = [...completedOrders].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )
  const firstCompleted = sortedCompleted[0]
  const lastCompleted = sortedCompleted[sortedCompleted.length - 1]
  const frequencyDays =
    firstCompleted && lastCompleted && completedOrders.length > 1
      ? Math.max(
          1,
          Math.round(
            (lastCompleted.createdAt.getTime() - firstCompleted.createdAt.getTime()) /
              (completedOrders.length - 1) /
              86_400_000,
          ),
        )
      : null
  const lastOrderAt = orders[0]?.createdAt.toISOString()
  const segment = resolveCustomerSegment({
    completedOrders: completedOrders.length,
    totalSpent,
    lastOrderAt,
  })

  return {
    orderCount: activeOrders.length,
    completedOrders: completedOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalSpent,
    averageTicket,
    frequencyDays,
    lastOrderAt,
    segment,
    favoriteItems: resolveFavoriteItems(completedOrders),
  }
}

function resolveCustomerSegment(params: {
  completedOrders: number
  totalSpent: number
  lastOrderAt?: string
}): CustomerCrmSummary['segment'] {
  if (params.lastOrderAt) {
    const inactiveDays = Math.floor((Date.now() - new Date(params.lastOrderAt).getTime()) / 86_400_000)
    if (inactiveDays >= 60) {
      return 'inactive'
    }
  }

  if (params.completedOrders >= 10 || params.totalSpent >= 1000) {
    return 'vip'
  }

  if (params.completedOrders >= 2) {
    return 'recurring'
  }

  return 'new'
}

function resolveFavoriteItems(
  orders: Array<
    Prisma.OrderGetPayload<{
      include: {
        items: true
      }
    }>
  >,
) {
  const totals = new Map<string, number>()

  for (const order of orders) {
    for (const item of order.items) {
      totals.set(item.name, (totals.get(item.name) ?? 0) + item.quantity)
    }
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name]) => name)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function average(values: number[]) {
  if (!values.length) {
    return null
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
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
