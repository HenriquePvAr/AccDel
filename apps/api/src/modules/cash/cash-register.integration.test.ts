import assert from 'node:assert/strict'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

test(
  'integracao cash: constraint de sessao aberta e idempotencia por movimento',
  { skip: process.env.RUN_DB_INTEGRATION !== '1' },
  async () => {
    const databaseUrl = process.env.DATABASE_URL ?? ''
    assert.match(databaseUrl, /accdel_.*test/)
    const prisma = new PrismaClient()
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const storeId = `cash-store-${suffix}`
    const terminalId = `cash-terminal-${suffix}`
    const registerId = `cash-register-${suffix}`

    try {
      await prisma.store.create({
        data: {
          id: storeId,
          name: 'Restaurante Laboratorio',
          tradeName: 'Restaurante Laboratorio',
          city: 'Manaus',
          state: 'AM',
          brandAccent: '#111111',
        },
      })

      await prisma.cashTerminal.create({
        data: {
          id: terminalId,
          storeId,
          code: 'main',
          name: 'Caixa principal',
        },
      })

      await prisma.cashRegister.create({
        data: {
          id: registerId,
          storeId,
          terminalId,
          status: 'open',
          operatorName: 'Sara Vale',
          openedByName: 'Sara Vale',
          openingAmount: 150,
          expectedAmount: 150,
          movements: {
            create: {
              storeId,
              type: 'OPENING_BALANCE',
              method: 'cash',
              amount: 150,
              label: 'Valor inicial',
              userName: 'Sara Vale',
              operatorName: 'Sara Vale',
              balanceBefore: 0,
              balanceAfter: 150,
              idempotencyKey: 'open-1',
            },
          },
        },
      })

      await assert.rejects(() =>
        prisma.cashRegister.create({
          data: {
            storeId,
            terminalId,
            status: 'open',
            operatorName: 'Sara Vale',
            openingAmount: 0,
            expectedAmount: 0,
          },
        }),
      )

      await prisma.cashMovement.create({
        data: {
          storeId,
          cashRegisterId: registerId,
          type: 'CASH_SUPPLY',
          method: 'cash',
          amount: 50,
          label: 'Dinheiro adicionado',
          reason: 'Troco adicional',
          userName: 'Sara Vale',
          operatorName: 'Sara Vale',
          balanceBefore: 150,
          balanceAfter: 200,
          idempotencyKey: 'supply-1',
        },
      })

      await assert.rejects(() =>
        prisma.cashMovement.create({
          data: {
            storeId,
            cashRegisterId: registerId,
            type: 'CASH_SUPPLY',
            method: 'cash',
            amount: 50,
            label: 'Dinheiro adicionado',
            reason: 'Troco adicional',
            userName: 'Sara Vale',
            operatorName: 'Sara Vale',
            balanceBefore: 150,
            balanceAfter: 200,
            idempotencyKey: 'supply-1',
          },
        }),
      )
    } finally {
      await prisma.cashMovement.deleteMany({ where: { storeId } })
      await prisma.cashRegister.deleteMany({ where: { storeId } })
      await prisma.cashTerminal.deleteMany({ where: { storeId } })
      await prisma.store.deleteMany({ where: { id: storeId } })
      await prisma.$disconnect()
    }
  },
)
