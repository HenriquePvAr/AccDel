import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma, ProductChannel } from '@prisma/client'

import type {
  SaveDeliveryZonePayload,
  SavePaymentMethodConfigPayload,
  UpdateOperationalSettingsPayload,
} from '@/contracts/settings.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { mapDeliveryZone, mapPaymentMethodConfig, mapStoreSettings } from './settings.mapper'

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreSettings() {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: {
        id: getCurrentStoreId(),
      },
    })

    return {
      data: mapStoreSettings(store),
    }
  }

  async updateOperationalSettings(payload: UpdateOperationalSettingsPayload) {
    const store = await this.prisma.store.update({
      where: {
        id: getCurrentStoreId(),
      },
      data: this.mapStoreUpdatePayload(payload),
    })

    return {
      data: mapStoreSettings(store),
    }
  }

  async listPaymentMethods() {
    const methods = await this.prisma.paymentMethodConfig.findMany({
      where: {
        storeId: getCurrentStoreId(),
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

  async listDeliveryZones() {
    const zones = await this.prisma.deliveryZone.findMany({
      where: {
        storeId: getCurrentStoreId(),
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          neighborhood: 'asc',
        },
      ],
    })

    return {
      data: zones.map(mapDeliveryZone),
    }
  }

  async saveDeliveryZone(payload: SaveDeliveryZonePayload) {
    if (payload.id) {
      return this.updateDeliveryZone(payload.id, payload)
    }

    const zone = await this.prisma.deliveryZone.create({
      data: {
        storeId: getCurrentStoreId(),
        neighborhood: payload.neighborhood.trim(),
        fee: payload.fee,
        active: payload.active,
        sortOrder: payload.sortOrder ?? 0,
        estimatedDeliveryTimeMinutes: payload.estimatedDeliveryTimeMinutes ?? null,
      },
    })

    return {
      data: mapDeliveryZone(zone),
    }
  }

  async updateDeliveryZone(zoneId: string, payload: SaveDeliveryZonePayload) {
    const current = await this.prisma.deliveryZone.findFirst({
      where: {
        id: zoneId,
        storeId: getCurrentStoreId(),
      },
    })

    if (!current) {
      throw new NotFoundException('Bairro de entrega nao encontrado.')
    }

    const zone = await this.prisma.deliveryZone.update({
      where: {
        id: current.id,
      },
      data: {
        neighborhood: payload.neighborhood.trim(),
        fee: payload.fee,
        active: payload.active,
        sortOrder: payload.sortOrder ?? current.sortOrder,
        estimatedDeliveryTimeMinutes: payload.estimatedDeliveryTimeMinutes ?? null,
      },
    })

    return {
      data: mapDeliveryZone(zone),
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
        storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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

  private mapStoreUpdatePayload(payload: UpdateOperationalSettingsPayload): Prisma.StoreUpdateInput {
    const data: Prisma.StoreUpdateInput = {}

    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.tradeName !== undefined) data.tradeName = payload.tradeName.trim()
    if (payload.city !== undefined) data.city = payload.city.trim()
    if (payload.state !== undefined) data.state = payload.state.trim()
    if (payload.businessDays !== undefined) data.businessDays = payload.businessDays
    if (payload.defaultDeliveryFee !== undefined) data.defaultDeliveryFee = payload.defaultDeliveryFee
    if (payload.minimumOrderAmount !== undefined) data.minimumOrderAmount = payload.minimumOrderAmount
    if (payload.deliveryEnabled !== undefined) data.deliveryEnabled = payload.deliveryEnabled
    if (payload.pickupEnabled !== undefined) data.pickupEnabled = payload.pickupEnabled
    if (payload.counterEnabled !== undefined) data.counterEnabled = payload.counterEnabled
    if (payload.dineInEnabled !== undefined) data.dineInEnabled = payload.dineInEnabled
    if (payload.digitalMenuEnabled !== undefined) data.digitalMenuEnabled = payload.digitalMenuEnabled
    if (payload.whatsappAiEnabled !== undefined) data.whatsappAiEnabled = payload.whatsappAiEnabled
    if (payload.autoAcceptEnabled !== undefined) data.autoAcceptEnabled = payload.autoAcceptEnabled
    if (payload.estimatedPrepTimeMinutes !== undefined) {
      data.estimatedPrepTimeMinutes = payload.estimatedPrepTimeMinutes
    }
    if (payload.estimatedDeliveryTimeMinutes !== undefined) {
      data.estimatedDeliveryTimeMinutes = payload.estimatedDeliveryTimeMinutes
    }
    if (payload.estimatedDineInTimeMinutes !== undefined) {
      data.estimatedDineInTimeMinutes = payload.estimatedDineInTimeMinutes
    }
    if (payload.estimatedCounterTimeMinutes !== undefined) {
      data.estimatedCounterTimeMinutes = payload.estimatedCounterTimeMinutes
    }
    if (payload.estimatedPickupTimeMinutes !== undefined) {
      data.estimatedPickupTimeMinutes = payload.estimatedPickupTimeMinutes
    }

    if (payload.logoUrl !== undefined) data.logoUrl = payload.logoUrl?.trim() || null
    if (payload.phone !== undefined) data.phone = payload.phone?.trim() || null
    if (payload.publicWhatsapp !== undefined) {
      data.publicWhatsapp = payload.publicWhatsapp?.trim() || null
    }
    if (payload.addressLine !== undefined) data.addressLine = payload.addressLine?.trim() || null
    if (payload.neighborhood !== undefined) {
      data.neighborhood = payload.neighborhood?.trim() || null
    }
    if (payload.businessHours !== undefined) {
      data.businessHours = payload.businessHours?.trim() || null
    }
    if (payload.greetingMessage !== undefined) {
      data.greetingMessage = payload.greetingMessage?.trim() || null
    }
    if (payload.outOfHoursMessage !== undefined) {
      data.outOfHoursMessage = payload.outOfHoursMessage?.trim() || null
    }
    if (payload.cancellationPolicy !== undefined) {
      data.cancellationPolicy = payload.cancellationPolicy?.trim() || null
    }
    if (payload.generalNotes !== undefined) {
      data.generalNotes = payload.generalNotes?.trim() || null
    }

    return data
  }
}
