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
import { MessagingModule } from './modules/messaging/messaging.module'
import { OrdersModule } from './modules/orders/orders.module'
import { PrintingModule } from './modules/printing/printing.module'
import { ReportsModule } from './modules/reports/reports.module'
import { SettingsModule } from './modules/settings/settings.module'
import { TrackingModule } from './modules/tracking/tracking.module'
import { UsersModule } from './modules/users/users.module'
import { WaitersModule } from './modules/waiters/waiters.module'
import { WaiterModule } from './modules/waiter/waiter.module'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RealtimeModule } from './shared/realtime/realtime.module'
import { StoreContextInterceptor } from './shared/store-context.interceptor'
import { SecurityModule } from './shared/security/security.module'
import { validateEnvironment } from './config/environment.validation'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    RealtimeModule,
    PrismaModule,
    AuthModule,
    SecurityModule,
    MessagingModule,
    TrackingModule,
    HealthModule,
    CustomersModule,
    OrdersModule,
    PrintingModule,
    CatalogModule,
    CashModule,
    DriversModule,
    DiningModule,
    WaitersModule,
    WaiterModule,
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
