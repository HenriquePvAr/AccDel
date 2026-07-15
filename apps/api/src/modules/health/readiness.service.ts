import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { FeatureFlagsService } from '@/shared/operations/feature-flags.service'
import { ObservabilityService } from '@/shared/operations/observability.service'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly features: FeatureFlagsService,
    private readonly observability: ObservabilityService,
  ) {}

  async snapshot() {
    const storeId = getCurrentStoreId()
    const expectedMigrations = this.config.get<number>('EXPECTED_MIGRATION_COUNT') ?? 23
    const agentOnlineSince = new Date(Date.now() - 2 * 60_000)
    const openOrderStatuses = [
      'in_analysis',
      'in_preparation',
      'ready',
      'out_for_delivery',
    ] as const

    try {
      await this.prisma.$queryRaw`SELECT 1`
      const [migrationRows, outboundPending, outboundFailed, printPending, printFailed,
        agentsOnline, agentsOffline, waitingHuman, delayedOrders] = await Promise.all([
        this.prisma.$queryRaw<Array<{ applied: bigint; failed: bigint }>>`
          SELECT
            COUNT(*) FILTER (
              WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
            )::bigint AS applied,
            COUNT(*) FILTER (
              WHERE finished_at IS NULL AND rolled_back_at IS NULL
            )::bigint AS failed
          FROM "_prisma_migrations"
        `,
        this.prisma.outboundMessage.count({
          where: { storeId, status: { in: ['PENDING', 'SENDING'] } },
        }),
        this.prisma.outboundMessage.count({ where: { storeId, status: 'FAILED' } }),
        this.prisma.printJob.count({
          where: {
            storeId,
            status: { in: ['PENDING', 'CLAIMED', 'PRINTING', 'RETRY_WAIT'] },
          },
        }),
        this.prisma.printJob.count({
          where: { storeId, status: { in: ['FAILED', 'PRINT_RESULT_UNKNOWN'] } },
        }),
        this.prisma.printAgent.count({
          where: {
            storeId,
            enabled: true,
            revokedAt: null,
            lastSeenAt: { gte: agentOnlineSince },
          },
        }),
        this.prisma.printAgent.count({
          where: {
            storeId,
            enabled: true,
            revokedAt: null,
            OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: agentOnlineSince } }],
          },
        }),
        this.prisma.aiConversation.count({
          where: { storeId, operationalStatus: 'WAITING_HUMAN' },
        }),
        this.prisma.order.count({
          where: {
            storeId,
            status: { in: [...openOrderStatuses] },
            OR: [{ delayed: true }, { dueAt: { lt: new Date() } }],
          },
        }),
      ])
      const migrations = {
        applied: Number(migrationRows[0]?.applied ?? 0),
        expected: expectedMigrations,
        failed: Number(migrationRows[0]?.failed ?? 0),
      }
      const features = this.features.snapshot()
      const blocked = migrations.applied !== migrations.expected || migrations.failed > 0
      const attention =
        outboundFailed + printFailed + agentsOffline + waitingHuman + delayedOrders > 0

      return {
        status: blocked ? 'blocked' : attention ? 'attention' : 'ready',
        service: 'cain-delivery-api',
        version: this.config.get<string>('SOURCE_COMMIT') ?? 'development',
        appEnvironment: this.config.get<string>('APP_ENV') ?? 'development',
        database: { reachable: true },
        migrations,
        queues: {
          outbound: { pending: outboundPending, failed: outboundFailed },
          printing: { pending: printPending, failed: printFailed },
        },
        printingAgents: { online: agentsOnline, offline: agentsOffline },
        operation: { waitingHuman, delayedOrders },
        integrations: {
          whatsapp: {
            enabled: features.whatsapp,
            provider: this.config.get<string>('WHATSAPP_PROVIDER') || 'disabled',
            sandbox: this.config.get<boolean>('MESSAGING_SANDBOX_MODE') ?? false,
          },
          ai: {
            enabled: features.aiAttendant,
            provider: this.config.get<string>('AI_PROVIDER') || 'disabled',
          },
        },
        features,
        metrics: this.observability.snapshot(),
        checkedAt: new Date().toISOString(),
      }
    } catch {
      return {
        status: 'blocked',
        service: 'cain-delivery-api',
        version: this.config.get<string>('SOURCE_COMMIT') ?? 'development',
        appEnvironment: this.config.get<string>('APP_ENV') ?? 'development',
        database: { reachable: false },
        migrations: { applied: 0, expected: expectedMigrations, failed: null },
        features: this.features.snapshot(),
        metrics: this.observability.snapshot(),
        checkedAt: new Date().toISOString(),
      }
    }
  }
}
