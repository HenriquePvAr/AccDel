import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'

import { PrismaService } from '@/shared/prisma/prisma.service'

@Injectable()
export class MessagingRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingRetentionService.name)
  private interval?: NodeJS.Timeout

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.interval = setInterval(() => void this.cleanup(), 24 * 60 * 60 * 1_000)
    this.interval.unref()
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval)
  }

  async cleanup(now = new Date()) {
    const [inbound, outbound] = await this.prisma.$transaction([
      this.prisma.inboundEvent.deleteMany({ where: { retentionUntil: { lt: now } } }),
      this.prisma.outboundMessage.deleteMany({ where: { retentionUntil: { lt: now } } }),
    ])
    if (inbound.count || outbound.count) {
      this.logger.log(`Retencao removeu ${inbound.count} eventos e ${outbound.count} mensagens.`)
    }
    return { inbound: inbound.count, outbound: outbound.count }
  }
}
