import { Module } from '@nestjs/common'

import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { PublicOrdersController } from './public-orders.controller'

@Module({
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
