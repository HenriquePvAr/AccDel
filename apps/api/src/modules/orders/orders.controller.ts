import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  createOrderSchema,
  confirmOrderPaymentSchema,
  listOrdersQuerySchema,
  repeatOrderSchema,
  updateOrderStatusSchema,
  type CreateOrderPayload,
  type ConfirmOrderPaymentPayload,
  type ListOrdersQuery,
  type RepeatOrderPayload,
  type UpdateOrderStatusPayload,
} from '@/contracts/orders.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { Idempotent } from '@/shared/security/idempotency.decorator'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { OrdersService } from './orders.service'

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Permissions('orders:view')
  listOrders(@Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery) {
    return this.ordersService.listOrders(query)
  }

  @Get(':id/tracking')
  @Public()
  getOrderTracking(@Param('id') id: string) {
    return this.ordersService.getOrderTracking(id)
  }

  @Get(':id')
  @Permissions('orders:view')
  getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id)
  }

  @Post()
  @Permissions('orders:create')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Idempotent({ operation: 'orders:create' })
  createOrder(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.ordersService.createOrder(body, authUser)
  }

  @Patch(':id/status')
  @Permissions('orders:update')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  @Idempotent({ operation: 'orders:status' })
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.ordersService.updateStatus(id, body, authUser)
  }

  @Post(':id/repeat')
  @Permissions('orders:create')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Idempotent({ operation: 'orders:repeat' })
  repeatOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(repeatOrderSchema)) body: RepeatOrderPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.ordersService.repeatOrder(id, body, authUser)
  }

  @Patch(':id/payment')
  @Permissions('payments:confirm')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Idempotent({ operation: 'orders:payment' })
  confirmPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmOrderPaymentSchema))
    body: ConfirmOrderPaymentPayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.ordersService.confirmPayment(id, body, authUser)
  }
}
