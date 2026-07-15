import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { Public } from '@/modules/auth/decorators/public.decorator'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { InboundEventIngressService } from '../application/inbound-event-ingress.service'
import { normalizeWhatsappCloudPayload } from '../infrastructure/whatsapp-cloud/whatsapp-cloud-normalizer'
import { WhatsappCloudWebhookSecurityService } from '../infrastructure/whatsapp-cloud/whatsapp-cloud-webhook-security.service'

type RawFastifyRequest = FastifyRequest & { rawBody?: Buffer }

@Controller('webhooks/whatsapp')
export class WhatsappCloudWebhookController {
  constructor(
    private readonly security: WhatsappCloudWebhookSecurityService,
    private readonly ingress: InboundEventIngressService,
  ) {}

  @Get()
  @Public()
  @RateLimit({ limit: 30, windowMs: 60_000, scopes: ['ip'] })
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    return this.security.verifyChallenge(mode, token, challenge)
  }

  @Post()
  @Public()
  @HttpCode(200)
  @RateLimit({ limit: 240, windowMs: 60_000, scopes: ['ip', 'store'] })
  async receive(@Body() body: unknown, @Req() request: RawFastifyRequest) {
    this.security.verifySignature({
      contentType: request.headers['content-type'],
      signature: request.headers['x-hub-signature-256'],
      rawBody: request.rawBody,
    })
    const events = normalizeWhatsappCloudPayload(body)
    const result = await this.ingress.accept(events)
    return { received: true, ...result }
  }
}
