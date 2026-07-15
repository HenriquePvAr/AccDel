import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { IdempotencyInterceptor } from './idempotency.interceptor'
import { IdempotencyService } from './idempotency.service'
import { RateLimitGuard } from './rate-limit.guard'
import { RateLimitService } from './rate-limit.service'

@Module({
  providers: [
    IdempotencyService,
    RateLimitService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [IdempotencyService, RateLimitService],
})
export class SecurityModule {}
