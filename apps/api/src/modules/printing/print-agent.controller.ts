import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'

import {
  printAgentClaimSchema,
  printAgentFailureSchema,
  printAgentHeartbeatSchema,
  printAgentStartedSchema,
  printAgentSuccessSchema,
  printAgentUnknownSchema,
  type PrintAgentClaimPayload,
  type PrintAgentFailurePayload,
  type PrintAgentHeartbeatPayload,
  type PrintAgentStartedPayload,
  type PrintAgentSuccessPayload,
  type PrintAgentUnknownPayload,
} from '@/contracts/printing.contract'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { CurrentPrintAgent } from './current-print-agent.decorator'
import { PrintAgentAuthGuard } from './print-agent-auth.guard'
import { PrintAgentService } from './print-agent.service'
import type { AuthenticatedPrintAgent } from './printing.types'

@Controller('print-agent')
@Public()
@UseGuards(PrintAgentAuthGuard)
@RateLimit({ limit: 240, windowMs: 60_000, scopes: ['ip'] })
export class PrintAgentController {
  constructor(private readonly service: PrintAgentService) {}

  @Get('configuration')
  getConfiguration(@CurrentPrintAgent() agent: AuthenticatedPrintAgent) {
    return this.service.getConfiguration(agent)
  }

  @Post('heartbeat')
  heartbeat(
    @CurrentPrintAgent() agent: AuthenticatedPrintAgent,
    @Body(new ZodValidationPipe(printAgentHeartbeatSchema))
    body: PrintAgentHeartbeatPayload,
  ) {
    return this.service.heartbeat(agent, body)
  }

  @Post('jobs/claim')
  claim(
    @CurrentPrintAgent() agent: AuthenticatedPrintAgent,
    @Body(new ZodValidationPipe(printAgentClaimSchema)) body: PrintAgentClaimPayload,
  ) {
    return this.service.claim(agent, body)
  }

  @Post('jobs/:id/started')
  markStarted(
    @Param('id') id: string,
    @CurrentPrintAgent() agent: AuthenticatedPrintAgent,
    @Body(new ZodValidationPipe(printAgentStartedSchema)) body: PrintAgentStartedPayload,
  ) {
    return this.service.markStarted(agent, id, body)
  }

  @Post('jobs/:id/success')
  markSuccess(
    @Param('id') id: string,
    @CurrentPrintAgent() agent: AuthenticatedPrintAgent,
    @Body(new ZodValidationPipe(printAgentSuccessSchema)) body: PrintAgentSuccessPayload,
  ) {
    return this.service.markSuccess(agent, id, body)
  }

  @Post('jobs/:id/failure')
  markFailure(
    @Param('id') id: string,
    @CurrentPrintAgent() agent: AuthenticatedPrintAgent,
    @Body(new ZodValidationPipe(printAgentFailureSchema)) body: PrintAgentFailurePayload,
  ) {
    return this.service.markFailure(agent, id, body)
  }

  @Post('jobs/:id/unknown')
  markUnknown(
    @Param('id') id: string,
    @CurrentPrintAgent() agent: AuthenticatedPrintAgent,
    @Body(new ZodValidationPipe(printAgentUnknownSchema)) body: PrintAgentUnknownPayload,
  ) {
    return this.service.markUnknown(agent, id, body)
  }
}
