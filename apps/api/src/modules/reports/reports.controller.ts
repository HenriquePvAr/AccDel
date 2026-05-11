import { Controller, Get, Query } from '@nestjs/common'

import {
  operationalReportsQuerySchema,
  type OperationalReportsQuery,
} from '@/contracts/reports.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { ReportsService } from './reports.service'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('operational')
  @Permissions('reports:view')
  getOperationalSnapshot(
    @Query(new ZodValidationPipe(operationalReportsQuerySchema))
    query: OperationalReportsQuery,
  ) {
    return this.reportsService.getOperationalSnapshot(query)
  }
}
