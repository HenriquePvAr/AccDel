import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'

import {
  kitchenQueueQuerySchema,
  markKitchenOrderReadySchema,
  moveKitchenOrderSchema,
  type KitchenQueueQuery,
  type MarkKitchenOrderReadyPayload,
  type MoveKitchenOrderPayload,
} from '@/contracts/kitchen.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { KitchenService } from './kitchen.service'

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('queue')
  @Permissions('kitchen:view')
  getQueue(@Query(new ZodValidationPipe(kitchenQueueQuerySchema)) query: KitchenQueueQuery) {
    return this.kitchenService.getQueue(query)
  }

  @Patch('orders/:id/ready')
  @Permissions('kitchen:update')
  markOrderReady(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markKitchenOrderReadySchema))
    body: MarkKitchenOrderReadyPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.kitchenService.markOrderReady(id, body, authUser)
  }

  @Patch('orders/:id/status')
  @Permissions('kitchen:update')
  moveOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveKitchenOrderSchema))
    body: MoveKitchenOrderPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.kitchenService.moveOrder(id, body, authUser)
  }
}
