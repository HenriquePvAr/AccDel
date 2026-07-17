import { Controller, Get, Param } from '@nestjs/common'

import { Public } from '@/modules/auth/decorators/public.decorator'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { PublicTrackingService } from './public-tracking.service'

@Controller('tracking')
export class PublicTrackingController {
  constructor(private readonly tracking: PublicTrackingService) {}

  @Get(':token')
  @Public()
  @RateLimit({ limit: 60, windowMs: 60_000, scopes: ['ip'] })
  get(@Param('token') token: string) {
    return this.tracking.resolve(token)
  }
}
