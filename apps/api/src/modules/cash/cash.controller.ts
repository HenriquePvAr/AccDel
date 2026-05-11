import { Body, Controller, Get, Post } from '@nestjs/common'

import {
  closeCashRegisterSchema,
  registerCashMovementSchema,
  type CloseCashRegisterPayload,
  type RegisterCashMovementPayload,
} from '@/contracts/cash.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
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
