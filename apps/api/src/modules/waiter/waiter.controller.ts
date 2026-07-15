import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common'
import type { Observable } from 'rxjs'

import {
  waiterCancelItemSchema,
  waiterExpectedVersionSchema,
  waiterOpenSessionSchema,
  waiterSendItemsSchema,
  waiterTransferSessionSchema,
  type WaiterCancelItemPayload,
  type WaiterExpectedVersionPayload,
  type WaiterOpenSessionPayload,
  type WaiterSendItemsPayload,
  type WaiterTransferSessionPayload,
} from '@/contracts/waiter.contract'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { Idempotent } from '@/shared/security/idempotency.decorator'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { WaiterActiveGuard } from './waiter-active.guard'
import { WaiterService } from './waiter.service'

@Controller('waiter')
@UseGuards(WaiterActiveGuard)
export class WaiterController {
  constructor(private readonly waiter: WaiterService) {}

  @Get('bootstrap')
  @Permissions('waiter:tables:view')
  bootstrap(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.waiter.getBootstrap(authUser)
  }

  @Get('profile')
  @Permissions('waiter:tables:view')
  profile(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.waiter.getProfile(authUser)
  }

  @Get('tables')
  @Permissions('waiter:tables:view')
  tables() {
    return this.waiter.listTables()
  }

  @Get('tables/:id')
  @Permissions('waiter:tables:view')
  table(@Param('id') id: string) {
    return this.waiter.getTable(id)
  }

  @Get('menu')
  @Permissions('waiter:tables:view')
  menu() {
    return this.waiter.getMenu()
  }

  @Sse('stream')
  @Permissions('waiter:tables:view')
  stream(): Observable<MessageEvent> {
    return this.waiter.stream()
  }

  @Post('tables/:id/sessions')
  @Permissions('waiter:sessions:create')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Idempotent({ operation: 'waiter:session:open' })
  openSession(
    @Param('id') id: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(waiterOpenSessionSchema)) body: WaiterOpenSessionPayload,
  ) {
    return this.waiter.openSession(id, body, authUser)
  }

  @Post('sessions/:id/items')
  @Permissions('waiter:orders:create', 'waiter:orders:send')
  @RateLimit({ limit: 40, windowMs: 60_000 })
  @Idempotent({ operation: 'waiter:items:send' })
  sendItems(
    @Param('id') id: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(waiterSendItemsSchema)) body: WaiterSendItemsPayload,
  ) {
    return this.waiter.sendItems(id, body, authUser)
  }

  @Post('sessions/:id/items/:itemId/cancel')
  @Permissions('waiter:orders:update', 'waiter:orders:cancel_item')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Idempotent({ operation: 'waiter:item:cancel' })
  cancelItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(waiterCancelItemSchema)) body: WaiterCancelItemPayload,
  ) {
    return this.waiter.cancelItem(id, itemId, body, authUser)
  }

  @Post('sessions/:id/items/:itemId/deliver')
  @Permissions('waiter:orders:update', 'waiter:items:deliver')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  @Idempotent({ operation: 'waiter:item:deliver' })
  deliverItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(waiterExpectedVersionSchema)) body: WaiterExpectedVersionPayload,
  ) {
    return this.waiter.deliverItem(id, itemId, body, authUser)
  }

  @Post('sessions/:id/request-close')
  @Permissions('waiter:sessions:close_request')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Idempotent({ operation: 'waiter:session:request-close' })
  requestClose(
    @Param('id') id: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(waiterExpectedVersionSchema)) body: WaiterExpectedVersionPayload,
  ) {
    return this.waiter.requestClose(id, body, authUser)
  }

  @Post('sessions/:id/transfer')
  @Permissions('waiter:tables:transfer')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Idempotent({ operation: 'waiter:session:transfer' })
  transfer(
    @Param('id') id: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(waiterTransferSessionSchema)) body: WaiterTransferSessionPayload,
  ) {
    return this.waiter.transferSession(id, body, authUser)
  }
}
