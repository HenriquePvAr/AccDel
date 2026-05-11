import { Injectable, NotFoundException } from '@nestjs/common'

import type {
  CloseCashRegisterPayload,
  RegisterCashMovementPayload,
} from '@/contracts/cash.contract'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

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
            userName: 'Operação',
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
        storeId: DEFAULT_STORE_ID,
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
}
