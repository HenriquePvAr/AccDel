import { Injectable } from '@nestjs/common'

import type { UpdateOperationalSettingsPayload } from '@/contracts/settings.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapStoreSettings } from './settings.mapper'

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreSettings() {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: {
        id: DEFAULT_STORE_ID,
      },
    })

    return {
      data: mapStoreSettings(store),
    }
  }

  async updateOperationalSettings(payload: UpdateOperationalSettingsPayload) {
    const store = await this.prisma.store.update({
      where: {
        id: DEFAULT_STORE_ID,
      },
      data: payload,
    })

    return {
      data: mapStoreSettings(store),
    }
  }
}
