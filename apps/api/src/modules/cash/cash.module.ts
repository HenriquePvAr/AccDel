import { Module } from '@nestjs/common'

import { CashController, CashRegistersController } from './cash.controller'
import { CashService } from './cash.service'

@Module({
  controllers: [CashController, CashRegistersController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
