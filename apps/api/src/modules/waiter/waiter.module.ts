import { Module } from '@nestjs/common'

import { CatalogModule } from '@/modules/catalog/catalog.module'
import { DiningModule } from '@/modules/dining/dining.module'
import { PrintingModule } from '@/modules/printing/printing.module'

import { WaiterActiveGuard } from './waiter-active.guard'
import { WaiterController } from './waiter.controller'
import { WaiterService } from './waiter.service'

@Module({
  imports: [CatalogModule, DiningModule, PrintingModule],
  controllers: [WaiterController],
  providers: [WaiterService, WaiterActiveGuard],
})
export class WaiterModule {}
