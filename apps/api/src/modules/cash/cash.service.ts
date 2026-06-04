import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import type {
  CloseCashRegisterPayload,
  OpenCashRegisterPayload,
  RegisterCashMovementPayload,
} from '@/contracts/cash.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { mapCashRegister } from './cash.mapper'

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentRegister() {
    const register = await this.findCurrentRegister()

    return {
      data: mapCashRegister(register),
    }
  }

  async openRegister(payload: OpenCashRegisterPayload, operatorName: string) {
    const currentOpen = await this.prisma.cashRegister.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        status: 'open',
      },
      include: {
        movements: true,
      },
      orderBy: {
        openedAt: 'desc',
      },
    })

    if (currentOpen) {
      throw new BadRequestException('Ja existe um caixa aberto para esta loja.')
    }

    const register = await this.prisma.cashRegister.create({
      data: {
        storeId: getCurrentStoreId(),
        status: 'open',
        operatorName: this.cleanDatabaseText(operatorName),
        openingAmount: payload.openingAmount,
        expectedAmount: payload.openingAmount,
        countedAmount: 0,
        differenceAmount: 0,
        movements:
          payload.openingAmount > 0
            ? {
                create: {
                  type: 'supply',
                  method: null,
                  amount: payload.openingAmount,
                  label: 'Valor inicial de abertura',
                  userName: this.cleanDatabaseText(operatorName),
                },
              }
            : undefined,
      },
      include: {
        movements: true,
      },
    })

    return {
      data: mapCashRegister(register),
    }
  }

  async registerMovement(payload: RegisterCashMovementPayload) {
    const register = await this.findCurrentRegister({ openOnly: true })
    const expectedDelta =
      payload.type === 'supply' || payload.type === 'sale'
        ? payload.amount
        : payload.type === 'withdrawal' || payload.type === 'refund'
          ? -payload.amount
          : 0

    const updated = await this.prisma.cashRegister.update({
      where: {
        id: register.id,
      },
      data: {
        expectedAmount: {
          increment: expectedDelta,
        },
        movements: {
          create: {
            type: payload.type,
            method: payload.type === 'sale' || payload.type === 'refund' ? 'pix' : null,
            amount: payload.amount,
            label: payload.label,
            userName: 'Operacao',
          },
        },
      },
      include: {
        movements: true,
      },
    })

    return {
      data: mapCashRegister(updated),
    }
  }

  async closeRegister(payload: CloseCashRegisterPayload) {
    const register = await this.findCurrentRegister({ openOnly: true })
    const countedAmount = payload.countedAmount ?? register.expectedAmount.toNumber()

    const updated = await this.prisma.cashRegister.update({
      where: {
        id: register.id,
      },
      data: {
        status: 'closed',
        countedAmount,
        differenceAmount: countedAmount - register.expectedAmount.toNumber(),
        closedAt: new Date(),
      },
      include: {
        movements: true,
      },
    })

    return {
      data: mapCashRegister(updated),
    }
  }

  private async findCurrentRegister(options?: { openOnly?: boolean }) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        ...(options?.openOnly ? { status: 'open' as const } : {}),
      },
      include: {
        movements: true,
      },
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

  private cleanDatabaseText(value: string) {
    const safe = value
      .replace(/\uFFFD/g, '')
      .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '')
      .trim()

    return safe || 'Operacao'
  }
}
