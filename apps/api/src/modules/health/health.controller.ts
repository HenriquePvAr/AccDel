import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { Public } from '@/modules/auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'cain-delivery-api',
      version: this.config.get<string>('SOURCE_COMMIT') ?? 'development',
    }
  }
}
