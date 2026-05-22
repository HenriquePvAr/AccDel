import { Injectable, NotFoundException } from '@nestjs/common'
import type { ProductChannel } from '@prisma/client'

import type {
  SavePaymentMethodConfigPayload,
  UpdateOperationalSettingsPayload,
} from '@/contracts/settings.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapPaymentMethodConfig, mapStoreSettings } from './settings.mapper'

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

  async listPaymentMethods() {
    const methods = await this.prisma.paymentMethodConfig.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    })

    return {
      data: methods.map(mapPaymentMethodConfig),
    }
  }

  async savePaymentMethod(payload: SavePaymentMethodConfigPayload) {
    if (payload.id) {
      return this.updatePaymentMethod(payload.id, payload)
    }

    const channels = payload.channels as ProductChannel[]
    const data = {
      name: payload.name.trim(),
      method: payload.method ?? null,
      provider: payload.provider,
      active: payload.active,
      requiresReceipt: payload.requiresReceipt,
      autoCashEntry: payload.autoCashEntry,
      channels,
      sortOrder: payload.sortOrder,
      externalEnabled: payload.externalEnabled ?? false,
    }

    const method = await this.prisma.paymentMethodConfig.create({
      data: {
        ...data,
        storeId: DEFAULT_STORE_ID,
        fixed: payload.fixed ?? false,
      },
    })

    return {
      data: mapPaymentMethodConfig(method),
    }
  }

  async updatePaymentMethod(methodId: string, payload: SavePaymentMethodConfigPayload) {
    const current = await this.prisma.paymentMethodConfig.findFirst({
      where: {
        id: methodId,
        storeId: DEFAULT_STORE_ID,
      },
    })

    if (!current) {
      throw new NotFoundException('Forma de pagamento nao encontrada.')
    }

    const channels = payload.channels as ProductChannel[]
    const method = await this.prisma.paymentMethodConfig.update({
      where: {
        id: current.id,
      },
      data: {
        name: payload.name.trim(),
        method: payload.method ?? null,
        provider: payload.provider,
        active: payload.active,
        fixed: current.fixed,
        requiresReceipt: payload.requiresReceipt,
        autoCashEntry: payload.autoCashEntry,
        channels,
        sortOrder: payload.sortOrder,
        externalEnabled: payload.externalEnabled ?? current.externalEnabled,
      },
    })

    return {
      data: mapPaymentMethodConfig(method),
    }
  }
}
