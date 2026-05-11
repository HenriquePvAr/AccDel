import { Controller, Get } from '@nestjs/common'

import { Public } from '@/modules/auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'cain-delivery-api',
      timestamp: new Date().toISOString(),
    }
  }
}
