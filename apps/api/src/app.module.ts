import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'

import { AiAttendantModule } from './modules/ai-attendant/ai-attendant.module'
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
import { UsersModule } from './modules/users/users.module'
import { WaitersModule } from './modules/waiters/waiters.module'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RealtimeModule } from './shared/realtime/realtime.module'
import { StoreContextInterceptor } from './shared/store-context.interceptor'

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
    UsersModule,
    AiAttendantModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: StoreContextInterceptor,
    },
  ],
})
export class AppModule {}
