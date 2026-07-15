import { Controller, Get } from '@nestjs/common'

import { Permissions } from '@/modules/auth/decorators/permissions.decorator'

import { ReadinessService } from './readiness.service'

@Controller('ready')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  @Permissions('dashboard:view')
  check() {
    return this.readiness.snapshot()
  }
}
