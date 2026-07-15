import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { isIP } from 'node:net'
import { randomUUID } from 'node:crypto'
import { Prisma, type PrintJobStatus } from '@prisma/client'

import type {
  ListPrintJobsQuery,
  PrintReasonPayload,
  ProvisionPrintAgentPayload,
  SavePrinterPayload,
  SavePrinterRoutingRulePayload,
  SavePrinterStationPayload,
  UpdatePrintingSettingsPayload,
} from '@/contracts/printing.contract'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { buildListResponse, normalizePagination } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

import type { PrintJobSnapshot } from './printing.types'
import {
  createAgentCredential,
  hashPrintPayload,
  sanitizePrintError,
} from './printing.utils'

const DEFAULT_STATIONS = [
  { code: 'COZINHA', name: 'Cozinha' },
  { code: 'BAR', name: 'Bar e bebidas' },
  { code: 'CAIXA', name: 'Caixa' },
  { code: 'EXPEDICAO', name: 'Expedicao' },
] as const

const DEFAULT_TEMPLATES = [
  { key: 'kitchen-order', version: 'v1', jobType: 'ORDER_INITIAL' as const },
  { key: 'bar-order', version: 'v1', jobType: 'ORDER_INITIAL' as const },
  { key: 'cashier-receipt', version: 'v1', jobType: 'CASHIER_RECEIPT' as const },
  { key: 'dispatch-order', version: 'v1', jobType: 'DISPATCH_ORDER' as const },
  { key: 'customer-receipt', version: 'v1', jobType: 'CUSTOMER_RECEIPT' as const },
  { key: 'test-page', version: 'v1', jobType: 'TEST_PAGE' as const },
] as const

@Injectable()
export class PrintingAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const storeId = getCurrentStoreId()
    await this.ensureDefaults(storeId)
    const [settings, stations, printers, routes, templates, agents, jobCounts] =
      await Promise.all([
        this.prisma.printingSettings.findUniqueOrThrow({ where: { storeId } }),
        this.prisma.printerStation.findMany({
          where: { storeId },
          orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
        }),
        this.prisma.printer.findMany({
          where: { storeId },
          include: { station: true, agent: true },
          orderBy: [{ station: { name: 'asc' } }, { name: 'asc' }],
        }),
        this.prisma.printerRoutingRule.findMany({
          where: { storeId },
          include: { station: true, product: true, category: true },
          orderBy: [{ scope: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
        }),
        this.prisma.printTemplate.findMany({
          where: { storeId },
          orderBy: [{ key: 'asc' }, { version: 'asc' }],
        }),
        this.prisma.printAgent.findMany({
          where: { storeId },
          include: {
            printers: { select: { id: true, name: true, enabled: true } },
            heartbeats: { orderBy: { occurredAt: 'desc' }, take: 1 },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.printJob.groupBy({
          by: ['status'],
          where: { storeId },
          _count: { _all: true },
        }),
      ])
    const onlineCutoff = Date.now() - 90_000

    return {
      data: {
        settings,
        stations,
        printers: printers.map((printer) => ({
          ...printer,
          agent: printer.agent
            ? {
                id: printer.agent.id,
                name: printer.agent.name,
                online:
                  printer.agent.enabled &&
                  !printer.agent.revokedAt &&
                  Boolean(
                    printer.agent.lastSeenAt &&
                      printer.agent.lastSeenAt.getTime() >= onlineCutoff,
                  ),
              }
            : null,
        })),
        routes,
        templates,
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          deviceName: agent.deviceName,
          version: agent.version,
          enabled: agent.enabled,
          tokenPrefix: agent.tokenPrefix,
          lastSeenAt: agent.lastSeenAt,
          revokedAt: agent.revokedAt,
          online:
            agent.enabled &&
            !agent.revokedAt &&
            Boolean(agent.lastSeenAt && agent.lastSeenAt.getTime() >= onlineCutoff),
          printers: agent.printers,
          availablePrinterIds: agent.heartbeats[0]?.availablePrinterIds ?? [],
        })),
        jobCounts: Object.fromEntries(
          jobCounts.map((entry) => [entry.status, entry._count._all]),
        ),
      },
    }
  }

  async createStation(payload: SavePrinterStationPayload, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    const station = await this.prisma.$transaction(async (tx) => {
      const created = await tx.printerStation.create({
        data: { storeId, ...payload },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          actorId: actor.sub,
          action: 'STATION_CREATED',
          metadata: { stationId: created.id, stationCode: created.code },
        },
      })
      return created
    })
    return { data: station }
  }

  async updateStation(
    stationId: string,
    payload: SavePrinterStationPayload,
    actor: AuthenticatedRequestUser,
  ) {
    const storeId = getCurrentStoreId()
    await this.ensureStation(stationId, storeId)
    const station = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.printerStation.update({
        where: { id: stationId },
        data: payload,
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          actorId: actor.sub,
          action: 'STATION_UPDATED',
          metadata: { stationId: updated.id, stationCode: updated.code },
        },
      })
      return updated
    })
    return { data: station }
  }

  async createPrinter(payload: SavePrinterPayload, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    await this.validatePrinterConfiguration(storeId, payload)
    const printer = await this.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.printer.updateMany({
          where: { storeId, stationId: payload.stationId, isDefault: true },
          data: { isDefault: false },
        })
      }
      const created = await tx.printer.create({
        data: {
          storeId,
          ...payload,
          agentId: payload.agentId ?? null,
          port: payload.port ?? null,
        },
        include: { station: true, agent: true },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          printerId: created.id,
          actorId: actor.sub,
          action: 'PRINTER_CREATED',
          metadata: {
            connectionType: created.connectionType,
            stationId: created.stationId,
          },
        },
      })
      return created
    })
    return { data: printer }
  }

  async updatePrinter(
    printerId: string,
    payload: SavePrinterPayload,
    actor: AuthenticatedRequestUser,
  ) {
    const storeId = getCurrentStoreId()
    const current = await this.ensurePrinter(printerId, storeId)
    await this.validatePrinterConfiguration(storeId, payload)
    const printer = await this.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.printer.updateMany({
          where: {
            storeId,
            stationId: payload.stationId,
            isDefault: true,
            id: { not: printerId },
          },
          data: { isDefault: false },
        })
      }
      const updated = await tx.printer.update({
        where: { id: printerId },
        data: {
          ...payload,
          agentId: payload.agentId ?? null,
          port: payload.port ?? null,
        },
        include: { station: true, agent: true },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          printerId: updated.id,
          actorId: actor.sub,
          action: 'PRINTER_UPDATED',
          metadata: {
            previousStationId: current.stationId,
            stationId: updated.stationId,
            enabled: updated.enabled,
          },
        },
      })
      return updated
    })
    return { data: printer }
  }

  async updateSettings(
    payload: UpdatePrintingSettingsPayload,
    actor: AuthenticatedRequestUser,
  ) {
    const storeId = getCurrentStoreId()
    await this.ensureDefaults(storeId)

    if (payload.fallbackPolicy === 'DEFAULT_STATION') {
      if (!payload.fallbackStationId) {
        throw new BadRequestException('Selecione a estacao padrao de fallback.')
      }
      const fallback = await this.prisma.printerStation.findFirst({
        where: { id: payload.fallbackStationId, storeId, enabled: true },
        include: { printers: { where: { enabled: true } } },
      })
      if (!fallback) {
        throw new BadRequestException('A estacao de fallback nao pertence a esta loja.')
      }
      if (payload.enabled && !fallback.printers.length) {
        throw new BadRequestException(
          'Configure uma impressora ativa na estacao de fallback antes de ativar a impressao.',
        )
      }
    }

    const settings = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.printingSettings.update({
        where: { storeId },
        data: payload,
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          actorId: actor.sub,
          action: 'SETTINGS_UPDATED',
          metadata: {
            enabled: updated.enabled,
            fallbackPolicy: updated.fallbackPolicy,
            fallbackStationId: updated.fallbackStationId,
          },
        },
      })
      return updated
    })
    return { data: settings }
  }

  async saveRoutingRule(
    payload: SavePrinterRoutingRulePayload,
    actor: AuthenticatedRequestUser,
  ) {
    const storeId = getCurrentStoreId()
    await this.ensureStation(payload.stationId, storeId)

    if (payload.scope === 'PRODUCT') {
      const product = await this.prisma.product.findFirst({
        where: { id: payload.productId ?? '', storeId },
        select: { id: true },
      })
      if (!product) {
        throw new NotFoundException('Produto da regra nao encontrado nesta loja.')
      }
    } else {
      const category = await this.prisma.category.findFirst({
        where: { id: payload.categoryId ?? '', storeId },
        select: { id: true },
      })
      if (!category) {
        throw new NotFoundException('Categoria da regra nao encontrada nesta loja.')
      }
    }

    const rule = await this.prisma.$transaction(async (tx) => {
      await tx.printerRoutingRule.deleteMany({
        where: {
          storeId,
          ...(payload.scope === 'PRODUCT'
            ? { productId: payload.productId }
            : { categoryId: payload.categoryId }),
        },
      })
      const created = await tx.printerRoutingRule.create({
        data: {
          storeId,
          scope: payload.scope,
          productId: payload.scope === 'PRODUCT' ? payload.productId : null,
          categoryId: payload.scope === 'CATEGORY' ? payload.categoryId : null,
          stationId: payload.stationId,
          priority: payload.priority,
          enabled: payload.enabled,
        },
        include: { station: true, product: true, category: true },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          actorId: actor.sub,
          action: 'ROUTING_RULE_SAVED',
          metadata: {
            ruleId: created.id,
            scope: created.scope,
            productId: created.productId,
            categoryId: created.categoryId,
            stationId: created.stationId,
          },
        },
      })
      return created
    })
    return { data: rule }
  }

  async deleteRoutingRule(ruleId: string, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    const current = await this.prisma.printerRoutingRule.findFirst({
      where: { id: ruleId, storeId },
    })
    if (!current) {
      throw new NotFoundException('Regra de roteamento nao encontrada.')
    }

    await this.prisma.$transaction([
      this.prisma.printerRoutingRule.delete({ where: { id: current.id } }),
      this.prisma.printAuditLog.create({
        data: {
          storeId,
          actorId: actor.sub,
          action: 'ROUTING_RULE_DELETED',
          metadata: { ruleId: current.id },
        },
      }),
    ])
    return { data: { id: current.id, deleted: true } }
  }

  async listJobs(query: ListPrintJobsQuery) {
    const storeId = getCurrentStoreId()
    const pagination = normalizePagination(query)
    const where: Prisma.PrintJobWhereInput = {
      storeId,
      ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
      ...(query.type && query.type !== 'all' ? { jobType: query.type } : {}),
      ...(query.stationId ? { stationId: query.stationId } : {}),
      ...(query.printerId ? { printerId: query.printerId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
    }
    const [jobs, total] = await Promise.all([
      this.prisma.printJob.findMany({
        where,
        include: {
          printer: { select: { id: true, name: true } },
          station: { select: { id: true, code: true, name: true } },
          claimedByAgent: { select: { id: true, name: true } },
          attempts: { orderBy: { attemptNumber: 'desc' }, take: 5 },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.printJob.count({ where }),
    ])
    return buildListResponse(jobs, total, query)
  }

  async createTestJob(printerId: string, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    await this.ensureDefaults(storeId)
    const printer = await this.prisma.printer.findFirst({
      where: { id: printerId, storeId },
      include: { station: true },
    })
    if (!printer?.enabled) {
      throw new BadRequestException('Ative a impressora antes de criar a pagina de teste.')
    }
    const template = await this.prisma.printTemplate.findFirst({
      where: { storeId, key: 'test-page', version: 'v1' },
    })
    const id = randomUUID()
    const now = new Date()
    const snapshot: PrintJobSnapshot = {
      schemaVersion: 1,
      jobId: id,
      documentType: 'TEST_PAGE',
      marker: 'ORIGINAL',
      order: {
        id: null,
        number: 'TESTE',
        createdAt: now.toISOString(),
        serviceType: 'test',
        tableCode: null,
        priority: 'normal',
        notes: 'Pagina de teste sem dados de cliente.',
      },
      station: {
        id: printer.station.id,
        code: printer.station.code,
        name: printer.station.name,
      },
      items: [],
    }
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.printJob.create({
        data: {
          id,
          storeId,
          printerId: printer.id,
          stationId: printer.stationId,
          stationCode: printer.station.code,
          templateId: template?.id,
          jobType: 'TEST_PAGE',
          templateKey: 'test-page',
          templateVersion: 'v1',
          payloadSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          payloadHash: hashPrintPayload(snapshot),
          idempotencyKey: `print:test:${id}`,
          priority: 100,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          jobId: created.id,
          printerId: printer.id,
          actorId: actor.sub,
          action: 'TEST_JOB_CREATED',
        },
      })
      return created
    })
    return { data: job }
  }

  async retryJob(jobId: string, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    const current = await this.ensureJob(jobId, storeId)
    if (!['FAILED', 'RETRY_WAIT'].includes(current.status)) {
      throw new ConflictException('Somente jobs falhos ou aguardando retry podem ser reprocessados.')
    }
    const printer = current.stationId
      ? await this.prisma.printer.findFirst({
          where: { storeId, stationId: current.stationId, enabled: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        })
      : null
    if (!printer) {
      throw new BadRequestException('Corrija o roteamento e configure uma impressora ativa.')
    }
    const job = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: { id: current.id, storeId, status: current.status },
        data: {
          printerId: printer.id,
          status: 'PENDING',
          availableAt: new Date(),
          failedAt: null,
          lastErrorCode: null,
          lastErrorMessageSanitized: null,
          maxAttempts: Math.max(current.maxAttempts, current.attemptCount + 1),
        },
      })
      if (changed.count !== 1) {
        throw new ConflictException('O job foi atualizado por outra requisicao.')
      }
      await tx.printAuditLog.create({
        data: {
          storeId,
          jobId: current.id,
          printerId: printer.id,
          actorId: actor.sub,
          action: 'JOB_MANUAL_RETRY',
        },
      })
      return tx.printJob.findUniqueOrThrow({ where: { id: current.id } })
    })
    return { data: job }
  }

  async cancelJob(jobId: string, payload: PrintReasonPayload, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    const current = await this.ensureJob(jobId, storeId)
    const cancellable: PrintJobStatus[] = ['PENDING', 'RETRY_WAIT', 'FAILED']
    if (!cancellable.includes(current.status)) {
      throw new ConflictException('O estado atual nao permite cancelamento seguro.')
    }
    const job = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: { id: current.id, storeId, status: current.status },
        data: { status: 'CANCELLED' },
      })
      if (changed.count !== 1) {
        throw new ConflictException('O job foi atualizado por outra requisicao.')
      }
      await tx.printAuditLog.create({
        data: {
          storeId,
          jobId: current.id,
          printerId: current.printerId,
          actorId: actor.sub,
          action: 'JOB_CANCELLED',
          reason: sanitizePrintError(payload.reason),
        },
      })
      return tx.printJob.findUniqueOrThrow({ where: { id: current.id } })
    })
    return { data: job }
  }

  async reprintJob(jobId: string, payload: PrintReasonPayload, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    const original = await this.ensureJob(jobId, storeId)
    if (['PENDING', 'CLAIMED', 'PRINTING', 'RETRY_WAIT'].includes(original.status)) {
      throw new ConflictException('Conclua ou cancele o job ativo antes de solicitar reimpressao.')
    }
    const printer = original.stationId
      ? await this.prisma.printer.findFirst({
          where: { storeId, stationId: original.stationId, enabled: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        })
      : null
    if (!printer) {
      throw new BadRequestException('Nao ha impressora ativa para a reimpressao.')
    }
    const id = randomUUID()
    const snapshot = copySnapshotForReprint(original.payloadSnapshot, id)
    const reason = sanitizePrintError(payload.reason)
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.printJob.create({
        data: {
          id,
          storeId,
          printerId: printer.id,
          stationId: original.stationId,
          stationCode: original.stationCode,
          orderId: original.orderId,
          templateId: original.templateId,
          jobType: 'REPRINT',
          templateKey: original.templateKey,
          templateVersion: original.templateVersion,
          payloadSnapshot: snapshot,
          payloadHash: hashPrintPayload(snapshot),
          idempotencyKey: `print:reprint:${id}`,
          priority: original.priority + 20,
          maxAttempts: original.maxAttempts,
          originalJobId: original.id,
          reprintReason: reason,
          requestedByUserId: actor.sub,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          jobId: created.id,
          printerId: printer.id,
          actorId: actor.sub,
          action: 'JOB_REPRINT_CREATED',
          reason,
          metadata: { originalJobId: original.id },
        },
      })
      return created
    })
    return { data: job }
  }

  async provisionAgent(payload: ProvisionPrintAgentPayload, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    const credential = createAgentCredential()
    const agent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.printAgent.create({
        data: {
          storeId,
          name: payload.name,
          deviceName: payload.deviceName,
          tokenHash: credential.tokenHash,
          tokenPrefix: credential.tokenPrefix,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          agentId: created.id,
          actorId: actor.sub,
          action: 'AGENT_PROVISIONED',
        },
      })
      return created
    })
    return {
      data: {
        agent: safeAgent(agent),
        token: credential.token,
        warning: 'Copie agora. O token nao podera ser recuperado novamente.',
      },
    }
  }

  async rotateAgent(agentId: string, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    await this.ensureAgent(agentId, storeId)
    const credential = createAgentCredential()
    const agent = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.printAgent.update({
        where: { id: agentId },
        data: {
          tokenHash: credential.tokenHash,
          tokenPrefix: credential.tokenPrefix,
          enabled: true,
          revokedAt: null,
        },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          agentId,
          actorId: actor.sub,
          action: 'AGENT_TOKEN_ROTATED',
        },
      })
      return updated
    })
    return {
      data: {
        agent: safeAgent(agent),
        token: credential.token,
        warning: 'O token anterior foi invalidado. Copie o novo token agora.',
      },
    }
  }

  async revokeAgent(agentId: string, actor: AuthenticatedRequestUser) {
    const storeId = getCurrentStoreId()
    await this.ensureAgent(agentId, storeId)
    const now = new Date()
    const agent = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.printAgent.update({
        where: { id: agentId },
        data: { enabled: false, revokedAt: now },
      })
      await tx.printAuditLog.create({
        data: {
          storeId,
          agentId,
          actorId: actor.sub,
          action: 'AGENT_REVOKED',
        },
      })
      return updated
    })
    return { data: safeAgent(agent) }
  }

  private async ensureDefaults(storeId: string) {
    await this.prisma.$transaction(async (tx) => {
      const stations = []
      for (const definition of DEFAULT_STATIONS) {
        stations.push(
          await tx.printerStation.upsert({
            where: { storeId_code: { storeId, code: definition.code } },
            create: { storeId, ...definition },
            update: {},
          }),
        )
      }
      const kitchen = stations.find((station) => station.code === 'COZINHA')
      const settings = await tx.printingSettings.upsert({
        where: { storeId },
        create: { storeId, fallbackStationId: kitchen?.id },
        update: {},
      })
      if (!settings.fallbackStationId && kitchen) {
        await tx.printingSettings.update({
          where: { storeId },
          data: { fallbackStationId: kitchen.id },
        })
      }
      for (const template of DEFAULT_TEMPLATES) {
        await tx.printTemplate.upsert({
          where: {
            storeId_key_version: {
              storeId,
              key: template.key,
              version: template.version,
            },
          },
          create: { storeId, ...template },
          update: {},
        })
      }
    })
  }

  private async validatePrinterConfiguration(storeId: string, payload: SavePrinterPayload) {
    await this.ensureStation(payload.stationId, storeId)
    if (payload.agentId) {
      await this.ensureAgent(payload.agentId, storeId)
    }

    if (payload.connectionType === 'NETWORK_TCP') {
      validateNetworkHost(payload.address)
    } else if (payload.connectionType === 'FILE_OR_VIRTUAL') {
      if (!/^[A-Za-z0-9._-]{1,80}$/.test(payload.address)) {
        throw new BadRequestException(
          'Use um identificador virtual simples, sem caminho de arquivo.',
        )
      }
    } else if (/[/\\\r\n]/.test(payload.address)) {
      throw new BadRequestException('Nome de impressora do Windows invalido.')
    }
  }

  private async ensureStation(id: string, storeId: string) {
    const station = await this.prisma.printerStation.findFirst({ where: { id, storeId } })
    if (!station) {
      throw new NotFoundException('Estacao de impressao nao encontrada.')
    }
    return station
  }

  private async ensurePrinter(id: string, storeId: string) {
    const printer = await this.prisma.printer.findFirst({ where: { id, storeId } })
    if (!printer) {
      throw new NotFoundException('Impressora nao encontrada.')
    }
    return printer
  }

  private async ensureAgent(id: string, storeId: string) {
    const agent = await this.prisma.printAgent.findFirst({ where: { id, storeId } })
    if (!agent) {
      throw new NotFoundException('Cain Print Agent nao encontrado.')
    }
    return agent
  }

  private async ensureJob(id: string, storeId: string) {
    const job = await this.prisma.printJob.findFirst({ where: { id, storeId } })
    if (!job) {
      throw new NotFoundException('Job de impressao nao encontrado.')
    }
    return job
  }
}

function validateNetworkHost(value: string) {
  if (
    value.includes('://') ||
    /[/\\\s@?#]/.test(value) ||
    (!isIP(value) && !isValidHostname(value))
  ) {
    throw new BadRequestException('Host ou IP da impressora de rede invalido.')
  }
}

function isValidHostname(value: string) {
  return (
    value.length <= 253 &&
    value.split('.').every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
    )
  )
}

function copySnapshotForReprint(value: Prisma.JsonValue, jobId: string): Prisma.InputJsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConflictException('Snapshot original invalido para reimpressao.')
  }

  return {
    ...(value as Prisma.JsonObject),
    jobId,
    documentType: 'REPRINT',
    marker: 'REIMPRESSAO',
  } as Prisma.InputJsonObject
}

function safeAgent(agent: {
  id: string
  storeId: string
  name: string
  deviceName: string
  version: string | null
  tokenPrefix: string
  enabled: boolean
  lastSeenAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: agent.id,
    storeId: agent.storeId,
    name: agent.name,
    deviceName: agent.deviceName,
    version: agent.version,
    tokenPrefix: agent.tokenPrefix,
    enabled: agent.enabled,
    lastSeenAt: agent.lastSeenAt,
    revokedAt: agent.revokedAt,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }
}
