import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuthModule } from './modules/auth/auth.module'
import { CashModule } from './modules/cash/cash.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { CustomersModule } from './modules/customers/customers.module'
import { DriversModule } from './modules/drivers/drivers.module'
import { DiningModule } from './modules/dining/dining.module'
import { HealthModule } from './modules/health/health.module'
import { KitchenModule } from './modules/kitchen/kitchen.module'
import { OrdersModule } from './modules/orders/orders.module'
import { ReportsModule } from './modules/reports/reports.module'
import { SettingsModule } from './modules/settings/settings.module'
import { WaitersModule } from './modules/waiters/waiters.module'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RealtimeModule } from './shared/realtime/realtime.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RealtimeModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    CustomersModule,
    OrdersModule,
    CatalogModule,
    CashModule,
    DriversModule,
    DiningModule,
    WaitersModule,
    KitchenModule,
    ReportsModule,
    SettingsModule,
  ],
})
export class AppModule {}
