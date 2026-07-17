import { Module } from '@nestjs/common'

import { PrintingModule } from '@/modules/printing/printing.module'

import { DiningController } from './dining.controller'
import { DiningService } from './dining.service'

@Module({
  imports: [PrintingModule],
  controllers: [DiningController],
  providers: [DiningService],
  exports: [DiningService],
})
export class DiningModule {}
