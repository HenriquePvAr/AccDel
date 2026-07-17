import { Module } from '@nestjs/common'

import { PrintingModule } from '@/modules/printing/printing.module'
import { TrackingModule } from '@/modules/tracking/tracking.module'

import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { PublicOrdersController } from './public-orders.controller'

@Module({
  imports: [PrintingModule, TrackingModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
