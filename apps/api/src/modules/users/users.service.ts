import { Injectable } from '@nestjs/common'

import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { mapUser } from './users.mapper'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const memberships = await this.prisma.storeUser.findMany({
      where: {
        storeId: getCurrentStoreId(),
      },
      include: {
        user: true,
      },
      orderBy: [
        {
          active: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    })

    return buildListResponse(
      memberships.map((membership) => mapUser(membership)),
      memberships.length,
    )
  }
}
