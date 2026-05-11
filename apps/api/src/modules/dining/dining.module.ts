import { Module } from '@nestjs/common'

import { DiningController } from './dining.controller'
import { DiningService } from './dining.service'

@Module({
  controllers: [DiningController],
  providers: [DiningService],
  exports: [DiningService],
})
export class DiningModule {}
