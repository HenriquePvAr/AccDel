import { Injectable, NotFoundException } from '@nestjs/common'

import type {
  SaveWaiterPayload,
  UpdateWaiterStatusPayload,
} from '@/contracts/waiters.contract'
import { buildListResponse } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapWaiter } from './waiters.mapper'

@Injectable()
export class WaitersService {
  constructor(private readonly prisma: PrismaService) {}

  async listWaiters() {
    const memberships = await this.prisma.storeUser.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'waiter',
      },
      include: {
        user: true,
        waiterProfile: {
          include: {
            history: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 4,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return buildListResponse(
      memberships.map((membership) => mapWaiter({ membership })),
      memberships.length,
    )
  }

  async getWaiterById(waiterId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'waiter',
        userId: waiterId,
      },
      include: {
        user: true,
        waiterProfile: {
          include: {
            history: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 12,
            },
          },
        },
      },
    })

    if (!membership) {
      throw new NotFoundException('Garcom nao encontrado.')
    }

    return {
      data: mapWaiter({ membership }),
    }
  }

  async createWaiter(payload: SaveWaiterPayload) {
    const { waiter } = payload

    await this.prisma.user.create({
      data: {
        id: waiter.id,
        name: waiter.name,
        email: waiter.email.trim().toLowerCase(),
        phone: waiter.phone,
        passwordHash: 'pending-reset',
        status: waiter.active ? 'active' : 'inactive',
        stores: {
          create: {
            storeId: DEFAULT_STORE_ID,
            role: 'waiter',
            active: waiter.active,
            waiterProfile: {
              create: {
                active: waiter.active,
                status: waiter.active ? waiter.status : 'paused',
                lastActivityAt: new Date(),
                history: {
                  create: {
                    label: 'Cadastro criado no admin',
                    value: null,
                  },
                },
              },
            },
          },
        },
      },
    })

    const createdWaiterId =
      waiter.id ??
      (
        await this.prisma.user.findUniqueOrThrow({
          where: {
            email: waiter.email.trim().toLowerCase(),
          },
          select: {
            id: true,
          },
        })
      ).id

    return this.getWaiterById(createdWaiterId)
  }

  async updateWaiter(waiterId: string, payload: SaveWaiterPayload) {
    const { waiter } = payload
    await this.ensureWaiterExists(waiterId)

    await this.prisma.user.update({
      where: {
        id: waiterId,
      },
      data: {
        name: waiter.name,
        email: waiter.email.trim().toLowerCase(),
        phone: waiter.phone,
        status: waiter.active ? 'active' : 'inactive',
      },
    })

    await this.prisma.storeUser.update({
      where: {
        storeId_userId: {
          storeId: DEFAULT_STORE_ID,
          userId: waiterId,
        },
      },
      data: {
        active: waiter.active,
        waiterProfile: {
          upsert: {
            update: {
              active: waiter.active,
              status: waiter.active ? waiter.status : 'paused',
              lastActivityAt: new Date(),
              history: {
                create: {
                  label: 'Cadastro atualizado no admin',
                  value: null,
                },
              },
            },
            create: {
              active: waiter.active,
              status: waiter.active ? waiter.status : 'paused',
              lastActivityAt: new Date(),
              history: {
                create: {
                  label: 'Cadastro criado no admin',
                  value: null,
                },
              },
            },
          },
        },
      },
    })

    return this.getWaiterById(waiterId)
  }

  async updateWaiterStatus(waiterId: string, payload: UpdateWaiterStatusPayload) {
    const membership = await this.ensureWaiterExists(waiterId)
    const nextStatus = payload.active ? (payload.status ?? membership.waiterProfile?.status ?? 'available') : 'paused'

    await this.prisma.user.update({
      where: {
        id: waiterId,
      },
      data: {
        status: payload.active ? 'active' : 'inactive',
      },
    })

    await this.prisma.storeUser.update({
      where: {
        storeId_userId: {
          storeId: DEFAULT_STORE_ID,
          userId: waiterId,
        },
      },
      data: {
        active: payload.active,
        waiterProfile: {
          upsert: {
            update: {
              active: payload.active,
              status: nextStatus,
              lastActivityAt: new Date(),
              history: {
                create: {
                  label: payload.active
                    ? `Acesso ativado (${buildWaiterStatusLabel(nextStatus)})`
                    : 'Acesso desativado',
                  value: null,
                },
              },
            },
            create: {
              active: payload.active,
              status: nextStatus,
              lastActivityAt: new Date(),
              history: {
                create: {
                  label: payload.active
                    ? `Acesso ativado (${buildWaiterStatusLabel(nextStatus)})`
                    : 'Acesso desativado',
                  value: null,
                },
              },
            },
          },
        },
      },
    })

    return this.getWaiterById(waiterId)
  }

  private async ensureWaiterExists(waiterId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        role: 'waiter',
        userId: waiterId,
      },
      include: {
        user: true,
        waiterProfile: {
          include: {
            history: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 12,
            },
          },
        },
      },
    })

    if (!membership) {
      throw new NotFoundException('Garcom nao encontrado.')
    }

    return membership
  }
}

function buildWaiterStatusLabel(status: 'available' | 'serving' | 'paused') {
  if (status === 'serving') {
    return 'atendendo'
  }

  if (status === 'paused') {
    return 'pausado'
  }

  return 'disponivel'
}
