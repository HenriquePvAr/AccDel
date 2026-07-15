import { Body, Controller, Post } from '@nestjs/common'

import {
  createPublicOrderSchema,
  type CreatePublicOrderPayload,
} from '@/contracts/orders.contract'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { Idempotent } from '@/shared/security/idempotency.decorator'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { OrdersService } from './orders.service'

@Controller('public/orders')
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Public()
  @RateLimit({ limit: 12, windowMs: 60_000, scopes: ['ip', 'store'] })
  @Idempotent({ operation: 'public:orders:create' })
  createPublicOrder(
    @Body(new ZodValidationPipe(createPublicOrderSchema)) body: CreatePublicOrderPayload,
  ) {
    return this.ordersService.createPublicOrder(body)
  }
}
