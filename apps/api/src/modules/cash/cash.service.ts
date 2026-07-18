import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, type AdminRole, type CashMovementType, type PaymentMethod } from '@prisma/client'

import type {
  AdjustCashMovementPayload,
  CashRegisterHistoryQuery,
  CloseCashRegisterPayload,
  OpenCashRegisterPayload,
  RegisterCashMovementPayload,
  SupplyCashRegisterPayload,
  WithdrawCashRegisterPayload,
} from '@/contracts/cash.contract'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { mapCashRegister } from './cash.mapper'

type CashTx = Prisma.TransactionClient

const moneyScale = 2

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async listTerminals() {
    const terminal = await this.ensureDefaultTerminal(this.prisma)
    const terminals = await this.prisma.cashTerminal.findMany({
      where: {
        storeId: getCurrentStoreId(),
        active: true,
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    })

    return {
      data: terminals.length ? terminals : [terminal],
    }
  }

  async getCurrentRegister() {
    const register = await this.findCurrentRegister()

    return {
      data: mapCashRegister(register),
    }
  }

  async getRegister(sessionId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: sessionId,
        storeId: getCurrentStoreId(),
      },
      include: cashRegisterInclude,
    })

    if (!register) {
      throw new NotFoundException('Caixa nao encontrado para esta loja.')
    }

    return {
      data: mapCashRegister(register),
    }
  }

  async listMovements(sessionId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: sessionId,
        storeId: getCurrentStoreId(),
      },
      include: cashRegisterInclude,
    })

    if (!register) {
      throw new NotFoundException('Caixa nao encontrado para esta loja.')
    }

    return {
      data: mapCashRegister(register).movements,
    }
  }

  async listHistory(query: CashRegisterHistoryQuery) {
    const registers = await this.prisma.cashRegister.findMany({
      where: {
        storeId: getCurrentStoreId(),
        ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
        ...(query.terminalId ? { terminalId: query.terminalId } : {}),
        ...(query.operatorId ? { openedByUserId: query.operatorId } : {}),
        ...(query.from || query.to
          ? {
              openedAt: {
                ...(query.from ? { gte: parseDate(query.from, 'Data inicial invalida.') } : {}),
                ...(query.to ? { lte: parseDate(query.to, 'Data final invalida.') } : {}),
              },
            }
          : {}),
      },
      include: cashRegisterInclude,
      orderBy: {
        openedAt: 'desc',
      },
      take: 100,
    })

    return {
      data: registers.map(mapCashRegister),
    }
  }

  async openRegister(
    payload: OpenCashRegisterPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    const storeId = getCurrentStoreId()

    try {
      const register = await this.prisma.$transaction(
        async (tx) => {
          const terminal = payload.terminalId
            ? await tx.cashTerminal.findFirst({
                where: {
                  id: payload.terminalId,
                  storeId,
                  active: true,
                },
              })
            : await this.ensureDefaultTerminal(tx)

          if (!terminal) {
            throw new BadRequestException('Caixa ou terminal invalido para esta loja.')
          }

          const currentOpen = await tx.cashRegister.findFirst({
            where: {
              storeId,
              terminalId: terminal.id,
              status: 'open',
            },
          })

          if (currentOpen) {
            throw new ConflictException('Ja existe um caixa aberto para este terminal.')
          }

          const openingAmount = toMoney(payload.openingAmount)
          const register = await tx.cashRegister.create({
            data: {
              storeId,
              terminalId: terminal.id,
              status: 'open',
              operatorName: cleanDatabaseText(authUser.name),
              openedByUserId: authUser.sub,
              openedByName: cleanDatabaseText(authUser.name),
              openingAmount,
              expectedAmount: openingAmount,
              countedAmount: toMoney(0),
              differenceAmount: toMoney(0),
              openingNote: cleanOptionalText(payload.note),
              idempotencyKey: cleanOptionalText(idempotencyKey),
              movements: {
                create: {
                  storeId,
                  type: 'OPENING_BALANCE',
                  method: 'cash',
                  amount: openingAmount,
                  label: 'Valor inicial',
                  reason: cleanOptionalText(payload.note),
                  userName: cleanDatabaseText(authUser.name),
                  operatorUserId: authUser.sub,
                  operatorName: cleanDatabaseText(authUser.name),
                  balanceBefore: toMoney(0),
                  balanceAfter: openingAmount,
                  idempotencyKey: cleanOptionalText(idempotencyKey),
                },
              },
            },
            include: cashRegisterInclude,
          })

          await this.createAudit(tx, {
            action: 'cash_register.opened',
            storeId,
            registerId: register.id,
            actor: authUser,
            idempotencyKey,
            metadata: {
              terminalId: terminal.id,
              openingAmount: openingAmount.toString(),
            },
          })

          return register
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      return {
        data: mapCashRegister(register),
      }
    } catch (error) {
      throw normalizeCashError(error)
    }
  }

  async registerMovement(
    payload: RegisterCashMovementPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    const type = normalizeLegacyMovementType(payload.type)

    if (type === 'CASH_SUPPLY') {
      return this.supplyCurrentRegister(
        {
          amount: payload.amount,
          reason: payload.reason ?? payload.label,
        },
        authUser,
        idempotencyKey,
      )
    }

    if (type === 'CASH_WITHDRAWAL') {
      return this.withdrawCurrentRegister(
        {
          amount: payload.amount,
          reason: payload.reason ?? payload.label,
        },
        authUser,
        idempotencyKey,
      )
    }

    if (type === 'CASH_ADJUSTMENT') {
      return this.adjustCurrentRegister(
        {
          amount: payload.amount,
          direction: 'increase',
          reason: payload.reason ?? payload.label,
          originalMovementId: payload.originalMovementId ?? '',
        },
        authUser,
        idempotencyKey,
      )
    }

    if (type === 'CASH_REFUND') {
      return this.recordCurrentMovement(
        {
          type,
          amount: payload.amount,
          reason: payload.reason ?? payload.label,
          label: 'Reembolso',
          authUser,
          idempotencyKey,
          deltaDirection: 'decrement',
        },
      )
    }

    throw new BadRequestException('Tipo de movimento de caixa invalido para lancamento manual.')
  }

  async supplyCurrentRegister(
    payload: SupplyCashRegisterPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    return this.recordCurrentMovement({
      type: 'CASH_SUPPLY',
      amount: payload.amount,
      reason: payload.reason,
      label: 'Dinheiro adicionado',
      authUser,
      idempotencyKey,
      deltaDirection: 'increment',
    })
  }

  async withdrawCurrentRegister(
    payload: WithdrawCashRegisterPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    return this.recordCurrentMovement({
      type: 'CASH_WITHDRAWAL',
      amount: payload.amount,
      reason: payload.reason,
      label: 'Dinheiro retirado',
      authUser,
      idempotencyKey,
      deltaDirection: 'decrement',
      approvedByUserId: payload.approvedByUserId,
    })
  }

  async supplyRegister(
    sessionId: string,
    payload: SupplyCashRegisterPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    return this.recordMovementForRegister(sessionId, {
      type: 'CASH_SUPPLY',
      amount: payload.amount,
      reason: payload.reason,
      label: 'Dinheiro adicionado',
      authUser,
      idempotencyKey,
      deltaDirection: 'increment',
    })
  }

  async withdrawRegister(
    sessionId: string,
    payload: WithdrawCashRegisterPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    return this.recordMovementForRegister(sessionId, {
      type: 'CASH_WITHDRAWAL',
      amount: payload.amount,
      reason: payload.reason,
      label: 'Dinheiro retirado',
      authUser,
      idempotencyKey,
      deltaDirection: 'decrement',
      approvedByUserId: payload.approvedByUserId,
    })
  }

  async adjustCurrentRegister(
    payload: AdjustCashMovementPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    const current = await this.findCurrentRegister({ openOnly: true })
    return this.adjustRegister(current.id, payload, authUser, idempotencyKey)
  }

  async adjustRegister(
    sessionId: string,
    payload: AdjustCashMovementPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
  ) {
    if (!payload.originalMovementId) {
      throw new BadRequestException('Informe o movimento original para corrigir.')
    }

    return this.recordMovementForRegister(sessionId, {
      type: 'CASH_ADJUSTMENT',
      amount: payload.amount,
      reason: payload.reason,
      label: 'Ajuste',
      authUser,
      idempotencyKey,
      deltaDirection: payload.direction === 'increase' ? 'increment' : 'decrement',
      originalMovementId: payload.originalMovementId,
    })
  }

  async closeRegister(
    payload: CloseCashRegisterPayload,
    authUser: AuthenticatedRequestUser,
    idempotencyKey?: string,
    sessionId?: string,
  ) {
    const storeId = getCurrentStoreId()

    try {
      const register = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.cashRegister.findFirst({
            where: {
              ...(sessionId ? { id: sessionId } : {}),
              storeId,
              status: 'open',
            },
            include: cashRegisterInclude,
            orderBy: {
              openedAt: 'desc',
            },
          })

          if (!current) {
            throw new NotFoundException('Nenhum caixa aberto encontrado para a loja.')
          }

          const countedAmount = toMoney(payload.countedAmount)
          const expectedAmount = toMoney(current.expectedAmount)
          const differenceAmount = countedAmount.minus(expectedAmount).toDecimalPlaces(moneyScale)

          if (!differenceAmount.isZero() && !cleanOptionalText(payload.differenceReason)) {
            throw new BadRequestException('Informe uma justificativa para a diferenca de caixa.')
          }

          const changed = await tx.cashRegister.updateMany({
            where: {
              id: current.id,
              storeId,
              status: 'open',
            },
            data: {
              status: 'closed',
              countedAmount,
              differenceAmount,
              closedByUserId: authUser.sub,
              closedByName: cleanDatabaseText(authUser.name),
              closedAt: new Date(),
              closingNote: cleanOptionalText(payload.note),
              differenceReason: cleanOptionalText(payload.differenceReason),
            },
          })

          if (changed.count !== 1) {
            throw new ConflictException('O caixa foi fechado por outra requisicao.')
          }

          if (!differenceAmount.isZero()) {
            await tx.cashMovement.create({
              data: {
                storeId,
                cashRegisterId: current.id,
                type: 'CLOSING_DIFFERENCE',
                method: 'cash',
                amount: differenceAmount.abs(),
                label: 'Diferenca no fechamento',
                reason: cleanOptionalText(payload.differenceReason),
                userName: cleanDatabaseText(authUser.name),
                operatorUserId: authUser.sub,
                operatorName: cleanDatabaseText(authUser.name),
                balanceBefore: expectedAmount,
                balanceAfter: countedAmount,
                idempotencyKey: cleanOptionalText(idempotencyKey),
              },
            })
          }

          await this.createAudit(tx, {
            action: 'cash_register.closed',
            storeId,
            registerId: current.id,
            actor: authUser,
            idempotencyKey,
            metadata: {
              expectedAmount: expectedAmount.toString(),
              countedAmount: countedAmount.toString(),
              differenceAmount: differenceAmount.toString(),
            },
          })

          return tx.cashRegister.findUniqueOrThrow({
            where: {
              id: current.id,
            },
            include: cashRegisterInclude,
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      return {
        data: mapCashRegister(register),
      }
    } catch (error) {
      throw normalizeCashError(error)
    }
  }

  async recordCashSale(input: {
    orderId: string
    orderNumber: string
    amount: Prisma.Decimal | number
    method: PaymentMethod
    actorName?: string
    paymentAuditId?: string
    idempotencyKey?: string
  }) {
    if (input.method !== 'cash') {
      return null
    }

    const storeId = getCurrentStoreId()
    const systemActor = {
      sub: 'system',
      name: input.actorName ?? 'Sistema',
      email: 'system@local',
      storeId,
      role: 'owner' as AdminRole,
      permissions: [],
    }

    const current = await this.findCurrentRegister({ openOnly: true }).catch(() => null)
    if (!current) {
      return null
    }

    return this.recordMovementForRegister(current.id, {
      type: 'CASH_SALE',
      amount: Number(input.amount),
      reason: `Venda em dinheiro do pedido ${input.orderNumber}`,
      label: `Venda em dinheiro - Pedido ${input.orderNumber}`,
      authUser: systemActor,
      idempotencyKey: input.idempotencyKey ?? `cash-sale:${input.orderId}`,
      deltaDirection: 'increment',
      orderId: input.orderId,
      paymentAuditId: input.paymentAuditId,
    })
  }

  private recordCurrentMovement(input: MovementInput) {
    return this.findCurrentRegister({ openOnly: true }).then((register) =>
      this.recordMovementForRegister(register.id, input),
    )
  }

  private async recordMovementForRegister(sessionId: string, input: MovementInput) {
    const storeId = getCurrentStoreId()

    try {
      const register = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.cashRegister.findFirst({
            where: {
              id: sessionId,
              storeId,
              status: 'open',
            },
            include: cashRegisterInclude,
          })

          if (!current) {
            throw new NotFoundException('Nenhum caixa aberto encontrado para esta operacao.')
          }

          if (input.originalMovementId) {
            const original = await tx.cashMovement.findFirst({
              where: {
                id: input.originalMovementId,
                storeId,
                cashRegisterId: current.id,
              },
            })

            if (!original) {
              throw new BadRequestException('Movimento original nao pertence a este caixa.')
            }
          }

          const amount = toMoney(input.amount)
          const balanceBefore = toMoney(current.expectedAmount)
          const signedDelta = input.deltaDirection === 'increment' ? amount : amount.negated()
          const balanceAfter = balanceBefore.plus(signedDelta).toDecimalPlaces(moneyScale)

          if (balanceAfter.isNegative()) {
            throw new BadRequestException('Nao e permitido retirar acima do saldo esperado.')
          }

          if (input.approvedByUserId && !canApproveCash(input.authUser)) {
            throw new ForbiddenException('Somente gerente, supervisor, administrador ou owner pode aprovar retirada.')
          }

          await tx.cashMovement.create({
            data: {
              storeId,
              cashRegisterId: current.id,
              type: input.type,
              method: 'cash',
              amount,
              label: input.label,
              reason: input.reason,
              userName: cleanDatabaseText(input.authUser.name),
              operatorUserId: input.authUser.sub,
              operatorName: cleanDatabaseText(input.authUser.name),
              approvedByUserId: input.approvedByUserId,
              approvedByName: input.approvedByUserId ? cleanDatabaseText(input.authUser.name) : null,
              balanceBefore,
              balanceAfter,
              idempotencyKey: cleanOptionalText(input.idempotencyKey),
              orderId: input.orderId,
              paymentAuditId: input.paymentAuditId,
              originalMovementId: input.originalMovementId,
            },
          })

          await tx.cashRegister.update({
            where: {
              id: current.id,
            },
            data: {
              expectedAmount: balanceAfter,
            },
          })

          await this.createAudit(tx, {
            action: cashAuditAction(input.type),
            storeId,
            registerId: current.id,
            actor: input.authUser,
            approvedByUserId: input.approvedByUserId,
            approvedByName: input.approvedByUserId ? input.authUser.name : undefined,
            idempotencyKey: input.idempotencyKey,
            metadata: {
              amount: amount.toString(),
              balanceBefore: balanceBefore.toString(),
              balanceAfter: balanceAfter.toString(),
              reason: input.reason,
              orderId: input.orderId,
              paymentAuditId: input.paymentAuditId,
            },
          })

          return tx.cashRegister.findUniqueOrThrow({
            where: {
              id: current.id,
            },
            include: cashRegisterInclude,
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      return {
        data: mapCashRegister(register),
      }
    } catch (error) {
      throw normalizeCashError(error)
    }
  }

  private async findCurrentRegister(options?: { openOnly?: boolean }) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        ...(options?.openOnly ? { status: 'open' as const } : {}),
      },
      include: cashRegisterInclude,
      orderBy: {
        openedAt: 'desc',
      },
    })

    if (!register) {
      throw new NotFoundException(
        options?.openOnly
          ? 'Nenhum caixa aberto encontrado para a loja.'
          : 'Nenhum caixa encontrado para a loja.',
      )
    }

    return register
  }

  private async ensureDefaultTerminal(tx: CashTx | PrismaService) {
    const storeId = getCurrentStoreId()
    const existing = await tx.cashTerminal.findFirst({
      where: {
        storeId,
        active: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (existing) {
      return existing
    }

    return tx.cashTerminal.create({
      data: {
        storeId,
        code: 'main',
        name: 'Caixa principal',
        description: 'Terminal padrao para operacao de caixa.',
      },
    })
  }

  private createAudit(
    tx: CashTx,
    input: {
      action: string
      storeId: string
      registerId?: string
      movementId?: string
      actor: AuthenticatedRequestUser
      approvedByUserId?: string
      approvedByName?: string
      idempotencyKey?: string
      metadata?: Record<string, unknown>
    },
  ) {
    return tx.cashAuditLog.create({
      data: {
        storeId: input.storeId,
        cashRegisterId: input.registerId,
        cashMovementId: input.movementId,
        action: input.action,
        actorUserId: input.actor.sub === 'system' ? null : input.actor.sub,
        actorName: cleanDatabaseText(input.actor.name),
        approvedByUserId: input.approvedByUserId,
        approvedByName: cleanOptionalText(input.approvedByName),
        idempotencyKey: cleanOptionalText(input.idempotencyKey),
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
      },
    })
  }
}

const cashRegisterInclude = {
  terminal: true,
  movements: true,
} satisfies Prisma.CashRegisterInclude

interface MovementInput {
  type: CashMovementType
  amount: number
  reason: string
  label: string
  authUser: AuthenticatedRequestUser
  idempotencyKey?: string
  deltaDirection: 'increment' | 'decrement'
  approvedByUserId?: string
  orderId?: string
  paymentAuditId?: string
  originalMovementId?: string
}

function normalizeLegacyMovementType(type: RegisterCashMovementPayload['type']): CashMovementType {
  const aliases: Record<RegisterCashMovementPayload['type'], CashMovementType> = {
    sale: 'CASH_SALE',
    supply: 'CASH_SUPPLY',
    withdrawal: 'CASH_WITHDRAWAL',
    adjustment: 'CASH_ADJUSTMENT',
    refund: 'CASH_REFUND',
    CASH_SUPPLY: 'CASH_SUPPLY',
    CASH_WITHDRAWAL: 'CASH_WITHDRAWAL',
    CASH_ADJUSTMENT: 'CASH_ADJUSTMENT',
    CASH_REFUND: 'CASH_REFUND',
  }

  return aliases[type]
}

function cashAuditAction(type: CashMovementType) {
  const actions: Partial<Record<CashMovementType, string>> = {
    CASH_SALE: 'cash_movement.sale',
    CASH_SUPPLY: 'cash_movement.supply',
    CASH_WITHDRAWAL: 'cash_movement.withdrawal',
    CASH_REFUND: 'cash_movement.refund',
    CASH_ADJUSTMENT: 'cash_movement.adjustment',
    CLOSING_DIFFERENCE: 'cash_movement.closing_difference',
    OPENING_BALANCE: 'cash_movement.opening_balance',
  }

  return actions[type] ?? 'cash_movement.recorded'
}

function canApproveCash(authUser: AuthenticatedRequestUser) {
  return ['owner', 'manager', 'supervisor'].includes(authUser.role)
}

function toMoney(value: Prisma.Decimal | number | string) {
  const money = new Prisma.Decimal(value).toDecimalPlaces(moneyScale)
  if (!money.isFinite()) {
    throw new BadRequestException('Valor monetario invalido.')
  }

  return money
}

function parseDate(value: string, message: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(message)
  }

  return date
}

function cleanOptionalText(value?: string | null) {
  const safe = value
    ?.replace(/\uFFFD/g, '')
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '')
    .trim()

  return safe || null
}

function cleanDatabaseText(value: string) {
  return cleanOptionalText(value) ?? 'Operacao'
}

function normalizeCashError(error: unknown): never {
  if (
    error instanceof BadRequestException ||
    error instanceof ConflictException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException
  ) {
    throw error
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException('Operacao de caixa duplicada ou concorrente.')
    }

    if (error.code === 'P2034') {
      throw new ConflictException('Operacao concorrente detectada. Tente novamente com a mesma chave.')
    }
  }

  throw error
}
