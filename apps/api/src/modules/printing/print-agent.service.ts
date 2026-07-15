import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, type PrintJob } from '@prisma/client'

import type {
  PrintAgentClaimPayload,
  PrintAgentFailurePayload,
  PrintAgentHeartbeatPayload,
  PrintAgentStartedPayload,
  PrintAgentSuccessPayload,
  PrintAgentUnknownPayload,
} from '@/contracts/printing.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'

import type { AuthenticatedPrintAgent } from './printing.types'
import {
  createLeaseCredential,
  hashOpaqueToken,
  sanitizePrintError,
  secureHashMatches,
} from './printing.utils'

interface ClaimedJob extends PrintJob {
  leaseToken: string
}

@Injectable()
export class PrintAgentService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguration(agent: AuthenticatedPrintAgent) {
    const printers = await this.prisma.printer.findMany({
      where: { storeId: agent.storeId, agentId: agent.id },
      include: { station: true },
      orderBy: [{ station: { name: 'asc' } }, { name: 'asc' }],
    })

    return {
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          storeId: agent.storeId,
        },
        printers: printers.map((printer) => ({
          id: printer.id,
          name: printer.name,
          station: {
            id: printer.station.id,
            code: printer.station.code,
            name: printer.station.name,
          },
          connectionType: printer.connectionType,
          address: printer.address,
          port: printer.port,
          paperWidth: printer.paperWidth,
          encoding: printer.encoding,
          enabled: printer.enabled,
        })),
      },
    }
  }

  async heartbeat(agent: AuthenticatedPrintAgent, payload: PrintAgentHeartbeatPayload) {
    const validPrinterIds = await this.resolveAvailablePrinters(
      agent,
      payload.availablePrinterIds,
    )
    const now = new Date()
    const retentionCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    await this.prisma.$transaction([
      this.prisma.printAgent.update({
        where: { id: agent.id },
        data: { version: payload.version, lastSeenAt: now },
      }),
      this.prisma.printAgentHeartbeat.create({
        data: {
          storeId: agent.storeId,
          agentId: agent.id,
          version: payload.version,
          availablePrinterIds: validPrinterIds,
          occurredAt: now,
        },
      }),
      this.prisma.printAgentHeartbeat.deleteMany({
        where: { agentId: agent.id, occurredAt: { lt: retentionCutoff } },
      }),
    ])

    return {
      data: {
        serverTime: now.toISOString(),
        availablePrinterIds: validPrinterIds,
      },
    }
  }

  async claim(agent: AuthenticatedPrintAgent, payload: PrintAgentClaimPayload) {
    const validPrinterIds = await this.resolveAvailablePrinters(
      agent,
      payload.availablePrinterIds,
    )

    if (!validPrinterIds.length) {
      return { data: [] }
    }

    const claimed = await this.prisma.$transaction(async (tx) => {
      await this.recoverExpiredLeases(tx, agent.storeId)
      const candidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT j.id
        FROM print_jobs AS j
        INNER JOIN printers AS p ON p.id = j.printer_id
        WHERE j.store_id = ${agent.storeId}
          AND p.store_id = ${agent.storeId}
          AND p.agent_id = ${agent.id}
          AND p.enabled = TRUE
          AND p.id IN (${Prisma.join(validPrinterIds)})
          AND j.status IN ('PENDING'::"PrintJobStatus", 'RETRY_WAIT'::"PrintJobStatus")
          AND j.available_at <= NOW()
          AND j.attempt_count < j.max_attempts
        ORDER BY j.priority DESC, j.available_at ASC, j.created_at ASC
        LIMIT ${payload.limit}
        FOR UPDATE OF j SKIP LOCKED
      `)
      const claimedJobs: ClaimedJob[] = []

      for (const candidate of candidates) {
        const lease = createLeaseCredential()
        const settings = await tx.printingSettings.findUnique({
          where: { storeId: agent.storeId },
          select: { leaseDurationSeconds: true },
        })
        const now = new Date()
        const leaseExpiresAt = new Date(
          now.getTime() + (settings?.leaseDurationSeconds ?? 60) * 1000,
        )
        const job = await tx.printJob.update({
          where: { id: candidate.id },
          data: {
            status: 'CLAIMED',
            attemptCount: { increment: 1 },
            claimedByAgentId: agent.id,
            claimedAt: now,
            leaseExpiresAt,
            leaseTokenHash: lease.tokenHash,
            lastErrorCode: null,
            lastErrorMessageSanitized: null,
          },
        })

        await tx.printJobAttempt.create({
          data: {
            jobId: job.id,
            agentId: agent.id,
            attemptNumber: job.attemptCount,
            status: 'CLAIMED',
            startedAt: now,
          },
        })
        await tx.printAuditLog.create({
          data: {
            storeId: agent.storeId,
            jobId: job.id,
            printerId: job.printerId,
            agentId: agent.id,
            action: 'JOB_CLAIMED',
            metadata: { attemptNumber: job.attemptCount, leaseExpiresAt },
          },
        })
        claimedJobs.push({ ...job, leaseToken: lease.token })
      }

      await tx.printAgent.update({
        where: { id: agent.id },
        data: { lastSeenAt: new Date() },
      })
      return claimedJobs
    })

    const details = claimed.length
      ? await this.prisma.printJob.findMany({
          where: { id: { in: claimed.map((job) => job.id) }, storeId: agent.storeId },
          include: { printer: true, station: true },
        })
      : []
    const detailById = new Map(details.map((job) => [job.id, job]))

    return {
      data: claimed.map((job) => {
        const detail = detailById.get(job.id)
        if (!detail?.printer) {
          throw new ConflictException('O job perdeu a impressora durante o claim.')
        }

        return {
          id: job.id,
          jobType: job.jobType,
          templateKey: job.templateKey,
          templateVersion: job.templateVersion,
          payloadSnapshot: job.payloadSnapshot,
          payloadHash: job.payloadHash,
          attemptNumber: job.attemptCount,
          leaseToken: job.leaseToken,
          leaseExpiresAt: job.leaseExpiresAt?.toISOString(),
          printer: {
            id: detail.printer.id,
            name: detail.printer.name,
            connectionType: detail.printer.connectionType,
            address: detail.printer.address,
            port: detail.printer.port,
            paperWidth: detail.printer.paperWidth,
            encoding: detail.printer.encoding,
          },
          station: detail.station
            ? {
                id: detail.station.id,
                code: detail.station.code,
                name: detail.station.name,
              }
            : null,
        }
      }),
    }
  }

  async markStarted(
    agent: AuthenticatedPrintAgent,
    jobId: string,
    payload: PrintAgentStartedPayload,
  ) {
    const leaseTokenHash = hashOpaqueToken(payload.leaseToken)
    const changed = await this.prisma.$transaction(async (tx) => {
      const count = await tx.printJob.updateMany({
        where: {
          id: jobId,
          storeId: agent.storeId,
          status: 'CLAIMED',
          claimedByAgentId: agent.id,
          leaseTokenHash,
          leaseExpiresAt: { gt: new Date() },
        },
        data: { status: 'PRINTING' },
      })

      if (count.count !== 1) {
        return false
      }

      const job = await tx.printJob.findUniqueOrThrow({ where: { id: jobId } })
      await tx.printJobAttempt.update({
        where: {
          jobId_attemptNumber: { jobId, attemptNumber: job.attemptCount },
        },
        data: { status: 'PRINTING' },
      })
      await tx.printAuditLog.create({
        data: {
          storeId: agent.storeId,
          jobId,
          printerId: job.printerId,
          agentId: agent.id,
          action: 'JOB_PRINTING',
        },
      })
      return true
    })

    if (!changed) {
      throw new ConflictException('Lease invalido, expirado ou job fora de CLAIMED.')
    }

    return { data: { id: jobId, status: 'PRINTING' as const } }
  }

  async markSuccess(
    agent: AuthenticatedPrintAgent,
    jobId: string,
    payload: PrintAgentSuccessPayload,
  ) {
    const leaseTokenHash = hashOpaqueToken(payload.leaseToken)
    const current = await this.findAgentJob(agent, jobId)

    if (
      current.status === 'PRINTED' &&
      current.claimedByAgentId === agent.id &&
      current.leaseTokenHash &&
      secureHashMatches(current.leaseTokenHash, leaseTokenHash)
    ) {
      return { data: { id: current.id, status: current.status, idempotent: true } }
    }

    const now = new Date()
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: {
          id: jobId,
          storeId: agent.storeId,
          status: 'PRINTING',
          claimedByAgentId: agent.id,
          leaseTokenHash,
          leaseExpiresAt: { gt: now },
        },
        data: {
          status: 'PRINTED',
          printedAt: now,
          leaseExpiresAt: null,
          lastErrorCode: null,
          lastErrorMessageSanitized: null,
        },
      })

      if (changed.count !== 1) {
        return null
      }

      const job = await tx.printJob.findUniqueOrThrow({ where: { id: jobId } })
      await tx.printJobAttempt.update({
        where: {
          jobId_attemptNumber: { jobId, attemptNumber: job.attemptCount },
        },
        data: {
          status: 'PRINTED',
          contentHash: payload.contentHash,
          durationMs: payload.durationMs,
          finishedAt: now,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId: agent.storeId,
          jobId,
          printerId: job.printerId,
          agentId: agent.id,
          action: 'JOB_PRINTED',
          metadata: { durationMs: payload.durationMs, contentHash: payload.contentHash },
        },
      })
      return job
    })

    if (!result) {
      throw new ConflictException('Confirmacao rejeitada por lease ou estado divergente.')
    }

    return { data: { id: jobId, status: 'PRINTED' as const, idempotent: false } }
  }

  async markFailure(
    agent: AuthenticatedPrintAgent,
    jobId: string,
    payload: PrintAgentFailurePayload,
  ) {
    const current = await this.findAgentJob(agent, jobId)
    this.assertActiveLease(current, agent.id, payload.leaseToken)
    const retry = payload.retryable && current.attemptCount < current.maxAttempts
    const status = retry ? 'RETRY_WAIT' : 'FAILED'
    const now = new Date()
    const errorMessage = sanitizePrintError(payload.errorMessage)
    const availableAt = retry
      ? new Date(now.getTime() + retryBackoffMs(current.attemptCount))
      : current.availableAt

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: {
          id: current.id,
          storeId: agent.storeId,
          status: { in: ['CLAIMED', 'PRINTING'] },
          claimedByAgentId: agent.id,
          leaseTokenHash: current.leaseTokenHash,
        },
        data: {
          status,
          availableAt,
          failedAt: retry ? null : now,
          claimedByAgentId: null,
          claimedAt: null,
          leaseExpiresAt: null,
          leaseTokenHash: null,
          lastErrorCode: payload.errorCode,
          lastErrorMessageSanitized: errorMessage,
        },
      })

      if (changed.count !== 1) {
        throw new ConflictException('Falha rejeitada por estado concorrente.')
      }

      await tx.printJobAttempt.update({
        where: {
          jobId_attemptNumber: {
            jobId: current.id,
            attemptNumber: current.attemptCount,
          },
        },
        data: {
          status: retry ? 'RETRY_SCHEDULED' : 'FAILED',
          errorCode: payload.errorCode,
          errorMessageSanitized: errorMessage,
          durationMs: payload.durationMs,
          finishedAt: now,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId: agent.storeId,
          jobId: current.id,
          printerId: current.printerId,
          agentId: agent.id,
          action: retry ? 'JOB_RETRY_SCHEDULED' : 'JOB_FAILED',
          metadata: { errorCode: payload.errorCode, availableAt, attempt: current.attemptCount },
        },
      })
    })

    return { data: { id: jobId, status, availableAt: availableAt.toISOString() } }
  }

  async markUnknown(
    agent: AuthenticatedPrintAgent,
    jobId: string,
    payload: PrintAgentUnknownPayload,
  ) {
    const current = await this.findAgentJob(agent, jobId)
    this.assertActiveLease(current, agent.id, payload.leaseToken, false)
    const now = new Date()
    const errorMessage = sanitizePrintError(payload.errorMessage)

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: {
          id: current.id,
          storeId: agent.storeId,
          status: { in: ['CLAIMED', 'PRINTING'] },
          claimedByAgentId: agent.id,
          leaseTokenHash: current.leaseTokenHash,
        },
        data: {
          status: 'PRINT_RESULT_UNKNOWN',
          ambiguousAt: now,
          leaseExpiresAt: null,
          lastErrorCode: payload.errorCode,
          lastErrorMessageSanitized: errorMessage,
        },
      })

      if (changed.count !== 1) {
        throw new ConflictException('Resultado ambiguo rejeitado por estado concorrente.')
      }

      await tx.printJobAttempt.update({
        where: {
          jobId_attemptNumber: {
            jobId: current.id,
            attemptNumber: current.attemptCount,
          },
        },
        data: {
          status: 'RESULT_UNKNOWN',
          errorCode: payload.errorCode,
          errorMessageSanitized: errorMessage,
          finishedAt: now,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId: agent.storeId,
          jobId: current.id,
          printerId: current.printerId,
          agentId: agent.id,
          action: 'JOB_RESULT_UNKNOWN',
          metadata: { errorCode: payload.errorCode, attempt: current.attemptCount },
        },
      })
    })

    return { data: { id: jobId, status: 'PRINT_RESULT_UNKNOWN' as const } }
  }

  private async resolveAvailablePrinters(
    agent: AuthenticatedPrintAgent,
    requestedIds: string[],
  ) {
    if (!requestedIds.length) {
      return []
    }

    const printers = await this.prisma.printer.findMany({
      where: {
        id: { in: Array.from(new Set(requestedIds)) },
        storeId: agent.storeId,
        agentId: agent.id,
        enabled: true,
      },
      select: { id: true },
    })
    return printers.map((printer) => printer.id)
  }

  private async recoverExpiredLeases(tx: Prisma.TransactionClient, storeId: string) {
    const ambiguous = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE print_jobs
      SET status = 'PRINT_RESULT_UNKNOWN'::"PrintJobStatus",
          ambiguous_at = NOW(),
          lease_expires_at = NULL,
          last_error_code = 'LEASE_EXPIRED_DURING_PRINTING',
          last_error_message_sanitized = 'O lease expirou depois que a impressao foi iniciada.',
          updated_at = NOW()
      WHERE store_id = ${storeId}
        AND status = 'PRINTING'::"PrintJobStatus"
        AND lease_expires_at <= NOW()
      RETURNING id
    `)
    const exhausted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE print_jobs
      SET status = 'FAILED'::"PrintJobStatus",
          failed_at = NOW(),
          claimed_by_agent_id = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          lease_token_hash = NULL,
          last_error_code = 'LEASE_ATTEMPTS_EXHAUSTED',
          last_error_message_sanitized = 'O job esgotou as tentativas antes de iniciar a impressao.',
          updated_at = NOW()
      WHERE store_id = ${storeId}
        AND status = 'CLAIMED'::"PrintJobStatus"
        AND lease_expires_at <= NOW()
        AND attempt_count >= max_attempts
      RETURNING id
    `)
    const retryable = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE print_jobs
      SET status = 'RETRY_WAIT'::"PrintJobStatus",
          available_at = NOW(),
          claimed_by_agent_id = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          lease_token_hash = NULL,
          last_error_code = 'LEASE_EXPIRED_BEFORE_PRINTING',
          last_error_message_sanitized = 'O lease expirou antes do inicio da impressao.',
          updated_at = NOW()
      WHERE store_id = ${storeId}
        AND status = 'CLAIMED'::"PrintJobStatus"
        AND lease_expires_at <= NOW()
        AND attempt_count < max_attempts
      RETURNING id
    `)

    if (ambiguous.length) {
      await tx.printJobAttempt.updateMany({
        where: { jobId: { in: ambiguous.map((entry) => entry.id) }, status: 'PRINTING' },
        data: {
          status: 'RESULT_UNKNOWN',
          errorCode: 'LEASE_EXPIRED_DURING_PRINTING',
          errorMessageSanitized: 'O lease expirou depois que a impressao foi iniciada.',
          finishedAt: new Date(),
        },
      })
    }

    if (exhausted.length) {
      await tx.printJobAttempt.updateMany({
        where: { jobId: { in: exhausted.map((entry) => entry.id) }, status: 'CLAIMED' },
        data: {
          status: 'FAILED',
          errorCode: 'LEASE_ATTEMPTS_EXHAUSTED',
          finishedAt: new Date(),
        },
      })
    }

    if (retryable.length) {
      await tx.printJobAttempt.updateMany({
        where: { jobId: { in: retryable.map((entry) => entry.id) }, status: 'CLAIMED' },
        data: {
          status: 'RETRY_SCHEDULED',
          errorCode: 'LEASE_EXPIRED_BEFORE_PRINTING',
          finishedAt: new Date(),
        },
      })
    }

    const auditRows = [
      ...ambiguous.map((entry) => ({ id: entry.id, action: 'JOB_RESULT_UNKNOWN' })),
      ...exhausted.map((entry) => ({ id: entry.id, action: 'JOB_FAILED' })),
      ...retryable.map((entry) => ({ id: entry.id, action: 'JOB_LEASE_RECOVERED' })),
    ]
    if (auditRows.length) {
      await tx.printAuditLog.createMany({
        data: auditRows.map((entry) => ({
          storeId,
          jobId: entry.id,
          action: entry.action,
          metadata: { source: 'lease_recovery' },
        })),
      })
    }
  }

  private async findAgentJob(agent: AuthenticatedPrintAgent, jobId: string) {
    const job = await this.prisma.printJob.findFirst({
      where: { id: jobId, storeId: agent.storeId },
    })

    if (!job) {
      throw new NotFoundException('Job de impressao nao encontrado.')
    }

    return job
  }

  private assertActiveLease(
    job: PrintJob,
    agentId: string,
    leaseToken: string,
    requireNotExpired = true,
  ) {
    const tokenHash = hashOpaqueToken(leaseToken)
    const valid =
      ['CLAIMED', 'PRINTING'].includes(job.status) &&
      job.claimedByAgentId === agentId &&
      job.leaseTokenHash &&
      secureHashMatches(job.leaseTokenHash, tokenHash) &&
      (!requireNotExpired || Boolean(job.leaseExpiresAt && job.leaseExpiresAt > new Date()))

    if (!valid) {
      throw new ConflictException('Lease invalido, expirado ou pertencente a outro agente.')
    }
  }
}

export function retryBackoffMs(attempt: number) {
  return Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempt - 1))
}
