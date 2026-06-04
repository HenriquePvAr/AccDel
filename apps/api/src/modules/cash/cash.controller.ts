import { Body, Controller, Get, Post } from '@nestjs/common'

import {
  closeCashRegisterSchema,
  openCashRegisterSchema,
  registerCashMovementSchema,
  type CloseCashRegisterPayload,
  type OpenCashRegisterPayload,
  type RegisterCashMovementPayload,
} from '@/contracts/cash.contract'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

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
  openRegister(
    @Body(new ZodValidationPipe(openCashRegisterSchema))
    body: OpenCashRegisterPayload,
    @CurrentAuthUser() authUser?: AuthenticatedRequestUser,
  ) {
    return this.cashService.openRegister(body, authUser?.name ?? 'Operacao')
  }

  @Post('movement')
  @Permissions('cash:manage')
  registerMovement(
    @Body(new ZodValidationPipe(registerCashMovementSchema))
    body: RegisterCashMovementPayload,
  ) {
    return this.cashService.registerMovement(body)
  }

  @Post('close')
  @Permissions('cash:manage')
  closeRegister(
    @Body(new ZodValidationPipe(closeCashRegisterSchema))
    body: CloseCashRegisterPayload,
  ) {
    return this.cashService.closeRegister(body)
  }
}
