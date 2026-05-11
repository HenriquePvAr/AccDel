import { Module } from '@nestjs/common'

import { OrdersModule } from '@/modules/orders/orders.module'

import { DriversController } from './drivers.controller'
import { DriversService } from './drivers.service'

@Module({
  imports: [OrdersModule],
  controllers: [DriversController],
  providers: [DriversService],
})
export class DriversModule {}
