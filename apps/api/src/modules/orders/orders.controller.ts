import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  createOrderSchema,
  listOrdersQuerySchema,
  updateOrderStatusSchema,
  type CreateOrderPayload,
  type ListOrdersQuery,
  type UpdateOrderStatusPayload,
} from '@/contracts/orders.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

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
  createOrder(@Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderPayload) {
    return this.ordersService.createOrder(body)
  }

  @Patch(':id/status')
  @Permissions('orders:update')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusPayload,
  ) {
    return this.ordersService.updateStatus(id, body)
  }

  @Post(':id/repeat')
  @Permissions('orders:create')
  repeatOrder(@Param('id') id: string) {
    return this.ordersService.repeatOrder(id)
  }
}
