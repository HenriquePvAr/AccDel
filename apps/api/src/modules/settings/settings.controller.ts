import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'

import {
  saveDeliveryZoneSchema,
  savePaymentMethodConfigSchema,
  updateOperationalSettingsSchema,
  type SaveDeliveryZonePayload,
  type SavePaymentMethodConfigPayload,
  type UpdateOperationalSettingsPayload,
} from '@/contracts/settings.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { SettingsService } from './settings.service'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('store')
  @Permissions('settings:store:view')
  getStoreSettings() {
    return this.settingsService.getStoreSettings()
  }

  @Patch('store/operational')
  @Permissions('settings:store:manage')
  updateOperationalSettings(
    @Body(new ZodValidationPipe(updateOperationalSettingsSchema))
    body: UpdateOperationalSettingsPayload,
  ) {
    return this.settingsService.updateOperationalSettings(body)
  }

  @Get('payments')
  @Permissions('settings:preferences:view')
  listPaymentMethods() {
    return this.settingsService.listPaymentMethods()
  }

  @Post('payments')
  @Permissions('settings:preferences:manage')
  createPaymentMethod(
    @Body(new ZodValidationPipe(savePaymentMethodConfigSchema))
    body: SavePaymentMethodConfigPayload,
  ) {
    return this.settingsService.savePaymentMethod(body)
  }

  @Patch('payments/:id')
  @Permissions('settings:preferences:manage')
  updatePaymentMethod(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savePaymentMethodConfigSchema))
    body: SavePaymentMethodConfigPayload,
  ) {
    return this.settingsService.updatePaymentMethod(id, body)
  }

  @Get('delivery-zones')
  @Permissions('settings:store:view')
  listDeliveryZones() {
    return this.settingsService.listDeliveryZones()
  }

  @Post('delivery-zones')
  @Permissions('settings:store:manage')
  createDeliveryZone(
    @Body(new ZodValidationPipe(saveDeliveryZoneSchema))
    body: SaveDeliveryZonePayload,
  ) {
    return this.settingsService.saveDeliveryZone(body)
  }

  @Patch('delivery-zones/:id')
  @Permissions('settings:store:manage')
  updateDeliveryZone(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDeliveryZoneSchema))
    body: SaveDeliveryZonePayload,
  ) {
    return this.settingsService.updateDeliveryZone(id, body)
  }
}
