import { Injectable } from '@nestjs/common'

import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers() {
    const customers = await this.prisma.customer.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        addresses: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return buildListResponse(
      customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
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
      })),
      customers.length,
    )
  }
}
