import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'

import {
  adjustCashMovementSchema,
  cashRegisterHistoryQuerySchema,
  closeCashRegisterSchema,
  openCashRegisterSchema,
  registerCashMovementSchema,
  supplyCashRegisterSchema,
  withdrawCashRegisterSchema,
  type AdjustCashMovementPayload,
  type CashRegisterHistoryQuery,
  type CloseCashRegisterPayload,
  type OpenCashRegisterPayload,
  type RegisterCashMovementPayload,
  type SupplyCashRegisterPayload,
  type WithdrawCashRegisterPayload,
} from '@/contracts/cash.contract'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { Idempotent } from '@/shared/security/idempotency.decorator'

import { CashService } from './cash.service'

@Controller('cash/register')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get()
  @Permissions('cash:view')
  getCurrentRegister() {
    return this.cashService.getCurrentRegister()
  }

  @Post('open')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash:register:open' })
  openRegister(
    @Body(new ZodValidationPipe(openCashRegisterSchema))
    body: OpenCashRegisterPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.openRegister(body, authUser, idempotencyKey)
  }

  @Post('movement')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash:register:movement' })
  registerMovement(
    @Body(new ZodValidationPipe(registerCashMovementSchema))
    body: RegisterCashMovementPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.registerMovement(body, authUser, idempotencyKey)
  }

  @Post('close')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash:register:close' })
  closeRegister(
    @Body(new ZodValidationPipe(closeCashRegisterSchema))
    body: CloseCashRegisterPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.closeRegister(body, authUser, idempotencyKey)
  }
}

@Controller('cash-registers')
export class CashRegistersController {
  constructor(private readonly cashService: CashService) {}

  @Get('terminals')
  @Permissions('cash:view')
  listTerminals() {
    return this.cashService.listTerminals()
  }

  @Get('current')
  @Permissions('cash:view')
  getCurrentRegister() {
    return this.cashService.getCurrentRegister()
  }

  @Get('history')
  @Permissions('cash:view')
  listHistory(
    @Query(new ZodValidationPipe(cashRegisterHistoryQuerySchema))
    query: CashRegisterHistoryQuery,
  ) {
    return this.cashService.listHistory(query)
  }

  @Get(':sessionId')
  @Permissions('cash:view')
  getRegister(@Param('sessionId') sessionId: string) {
    return this.cashService.getRegister(sessionId)
  }

  @Get(':sessionId/movements')
  @Permissions('cash:view')
  listMovements(@Param('sessionId') sessionId: string) {
    return this.cashService.listMovements(sessionId)
  }

  @Post('open')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash-registers:open' })
  openRegister(
    @Body(new ZodValidationPipe(openCashRegisterSchema))
    body: OpenCashRegisterPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.openRegister(body, authUser, idempotencyKey)
  }

  @Post(':sessionId/supply')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash-registers:supply' })
  supply(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(supplyCashRegisterSchema))
    body: SupplyCashRegisterPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.supplyRegister(sessionId, body, authUser, idempotencyKey)
  }

  @Post(':sessionId/withdraw')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash-registers:withdraw' })
  withdraw(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(withdrawCashRegisterSchema))
    body: WithdrawCashRegisterPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.withdrawRegister(sessionId, body, authUser, idempotencyKey)
  }

  @Post(':sessionId/adjust')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash-registers:adjust' })
  adjust(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(adjustCashMovementSchema))
    body: AdjustCashMovementPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.adjustRegister(sessionId, body, authUser, idempotencyKey)
  }

  @Post(':sessionId/close')
  @Permissions('cash:manage')
  @Idempotent({ operation: 'cash-registers:close' })
  close(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(closeCashRegisterSchema))
    body: CloseCashRegisterPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.cashService.closeRegister(body, authUser, idempotencyKey, sessionId)
  }
}
