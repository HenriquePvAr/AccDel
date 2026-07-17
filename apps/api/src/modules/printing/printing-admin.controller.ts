import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  listPrintJobsQuerySchema,
  printReasonSchema,
  provisionPrintAgentSchema,
  savePrinterRoutingRuleSchema,
  savePrinterSchema,
  savePrinterStationSchema,
  updatePrintingSettingsSchema,
  type ListPrintJobsQuery,
  type PrintReasonPayload,
  type ProvisionPrintAgentPayload,
  type SavePrinterPayload,
  type SavePrinterRoutingRulePayload,
  type SavePrinterStationPayload,
  type UpdatePrintingSettingsPayload,
} from '@/contracts/printing.contract'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { Idempotent } from '@/shared/security/idempotency.decorator'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { PrintingAdminService } from './printing-admin.service'

@Controller('printing')
export class PrintingAdminController {
  constructor(private readonly service: PrintingAdminService) {}

  @Get('overview')
  @Permissions('printing:view')
  getOverview() {
    return this.service.getOverview()
  }

  @Post('stations')
  @Permissions('printing:manage')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Idempotent({ operation: 'printing:station:create' })
  createStation(
    @Body(new ZodValidationPipe(savePrinterStationSchema)) body: SavePrinterStationPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.createStation(body, actor)
  }

  @Patch('stations/:id')
  @Permissions('printing:manage')
  updateStation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savePrinterStationSchema)) body: SavePrinterStationPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.updateStation(id, body, actor)
  }

  @Post('printers')
  @Permissions('printing:manage')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Idempotent({ operation: 'printing:printer:create' })
  createPrinter(
    @Body(new ZodValidationPipe(savePrinterSchema)) body: SavePrinterPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.createPrinter(body, actor)
  }

  @Patch('printers/:id')
  @Permissions('printing:manage')
  updatePrinter(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savePrinterSchema)) body: SavePrinterPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.updatePrinter(id, body, actor)
  }

  @Post('printers/:id/test')
  @Permissions('printing:manage')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @Idempotent({ operation: 'printing:printer:test' })
  createTestJob(
    @Param('id') id: string,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.createTestJob(id, actor)
  }

  @Patch('settings')
  @Permissions('printing:manage')
  updateSettings(
    @Body(new ZodValidationPipe(updatePrintingSettingsSchema))
    body: UpdatePrintingSettingsPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.updateSettings(body, actor)
  }

  @Post('routing-rules')
  @Permissions('printing:manage')
  @Idempotent({ operation: 'printing:routing:save' })
  saveRoutingRule(
    @Body(new ZodValidationPipe(savePrinterRoutingRuleSchema))
    body: SavePrinterRoutingRulePayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.saveRoutingRule(body, actor)
  }

  @Delete('routing-rules/:id')
  @Permissions('printing:manage')
  deleteRoutingRule(
    @Param('id') id: string,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.deleteRoutingRule(id, actor)
  }

  @Get('jobs')
  @Permissions('printing:view')
  listJobs(
    @Query(new ZodValidationPipe(listPrintJobsQuerySchema)) query: ListPrintJobsQuery,
  ) {
    return this.service.listJobs(query)
  }

  @Post('jobs/:id/retry')
  @Permissions('printing:manage')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Idempotent({ operation: 'printing:job:retry' })
  retryJob(
    @Param('id') id: string,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.retryJob(id, actor)
  }

  @Post('jobs/:id/cancel')
  @Permissions('printing:manage')
  @Idempotent({ operation: 'printing:job:cancel' })
  cancelJob(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(printReasonSchema)) body: PrintReasonPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.cancelJob(id, body, actor)
  }

  @Post('jobs/:id/reprint')
  @Permissions('printing:reprint')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Idempotent({ operation: 'printing:job:reprint' })
  reprintJob(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(printReasonSchema)) body: PrintReasonPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.reprintJob(id, body, actor)
  }

  @Post('agents')
  @Permissions('printing:manage')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  provisionAgent(
    @Body(new ZodValidationPipe(provisionPrintAgentSchema))
    body: ProvisionPrintAgentPayload,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.provisionAgent(body, actor)
  }

  @Post('agents/:id/rotate')
  @Permissions('printing:manage')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  rotateAgent(
    @Param('id') id: string,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.rotateAgent(id, actor)
  }

  @Post('agents/:id/revoke')
  @Permissions('printing:manage')
  revokeAgent(
    @Param('id') id: string,
    @CurrentAuthUser() actor: AuthenticatedRequestUser,
  ) {
    return this.service.revokeAgent(id, actor)
  }
}
