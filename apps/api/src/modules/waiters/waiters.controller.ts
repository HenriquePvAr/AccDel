import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'

import {
  saveWaiterSchema,
  updateWaiterStatusSchema,
  type SaveWaiterPayload,
  type UpdateWaiterStatusPayload,
} from '@/contracts/waiters.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { WaitersService } from './waiters.service'

@Controller('waiters')
export class WaitersController {
  constructor(private readonly waitersService: WaitersService) {}

  @Get()
  @Permissions('dining:view')
  listWaiters() {
    return this.waitersService.listWaiters()
  }

  @Get(':id')
  @Permissions('dining:view')
  getWaiterById(@Param('id') id: string) {
    return this.waitersService.getWaiterById(id)
  }

  @Post()
  @Permissions('users:manage')
  createWaiter(@Body(new ZodValidationPipe(saveWaiterSchema)) body: SaveWaiterPayload) {
    return this.waitersService.createWaiter(body)
  }

  @Patch(':id')
  @Permissions('users:manage')
  updateWaiter(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveWaiterSchema)) body: SaveWaiterPayload,
  ) {
    return this.waitersService.updateWaiter(id, body)
  }

  @Patch(':id/status')
  @Permissions('users:manage')
  updateWaiterStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWaiterStatusSchema))
    body: UpdateWaiterStatusPayload,
  ) {
    return this.waitersService.updateWaiterStatus(id, body)
  }
}
