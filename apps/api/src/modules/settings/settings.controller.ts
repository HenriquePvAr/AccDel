import { Body, Controller, Get, Patch } from '@nestjs/common'

import {
  updateOperationalSettingsSchema,
  type UpdateOperationalSettingsPayload,
} from '@/contracts/settings.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { SettingsService } from './settings.service'

@Controller('settings/store')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings:store:view')
  getStoreSettings() {
    return this.settingsService.getStoreSettings()
  }

  @Patch('operational')
  @Permissions('settings:store:manage')
  updateOperationalSettings(
    @Body(new ZodValidationPipe(updateOperationalSettingsSchema))
    body: UpdateOperationalSettingsPayload,
  ) {
    return this.settingsService.updateOperationalSettings(body)
  }
}
