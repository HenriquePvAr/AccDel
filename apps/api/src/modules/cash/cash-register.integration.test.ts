import assert from 'node:assert/strict'
import test from 'node:test'

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma, PrismaClient, type PaymentMethod } from '@prisma/client'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import type { PrismaService } from '@/shared/prisma/prisma.service'
import { runWithStoreContext } from '@/shared/store-context'

import { CashService } from './cash.service'

const integrationOptions = {
  skip: process.env.RUN_DB_INTEGRATION !== '1',
  timeout: 180_000,
}

test('caixa v2 PostgreSQL: regras, tenant, idempotencia e concorrencia', integrationOptions, async (t) => {
  assertSafeIntegrationDatabase()
  const prisma = new PrismaClient()
  const service = new CashService(prisma as unknown as PrismaService)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const storeA = `cash-store-a-${suffix}`
  const storeB = `cash-store-b-${suffix}`
  const cashierId = `cashier-${suffix}`
  const managerId = `manager-${suffix}`
  const terminalMain = `terminal-main-${suffix}`
  const terminalOtherStore = `terminal-other-${suffix}`
  const createdUserIds = [cashierId, managerId]
  const actorCashier = actor({ id: cashierId, storeId: storeA, name: 'Sara Vale', role: 'cashier' })
  const actorManager = actor({ id: managerId, storeId: storeA, name: 'Marina Gestora', role: 'manager' })

  const inStoreA = <T>(callback: () => T) =>
    runWithStoreContext({ storeId: storeA, source: 'auth' }, callback)
  const inStoreB = <T>(callback: () => T) =>
    runWithStoreContext({ storeId: storeB, source: 'auth' }, callback)

  try {
    await createFixture(prisma, {
      storeA,
      storeB,
      cashierId,
      managerId,
      terminalMain,
      terminalOtherStore,
    })

    let mainRegisterId = ''

    await t.test('1-3 abertura valida, zero e valor negativo', async () => {
      const opened = await inStoreA(() =>
        service.openRegister(
          { terminalId: terminalMain, openingAmount: 150, note: 'Inicio do turno' },
          actorCashier,
          `open-main-${suffix}`,
        ),
      )
      mainRegisterId = opened.data.id
      assert.equal(opened.data.openingAmount, 150)
      assert.equal(opened.data.expectedAmount, 150)
      assert.equal(opened.data.openedByName, 'Sara Vale')
      assert.equal(opened.data.movements.filter((entry) => entry.type === 'OPENING_BALANCE').length, 1)

      const zeroTerminal = await createTerminal(prisma, storeA, `zero-${suffix}`)
      const zero = await inStoreA(() =>
        service.openRegister(
          { terminalId: zeroTerminal, openingAmount: 0 },
          actorCashier,
          `open-zero-${suffix}`,
        ),
      )
      assert.equal(zero.data.expectedAmount, 0)
      await inStoreA(() =>
        service.closeRegister({ countedAmount: 0 }, actorCashier, `close-zero-${suffix}`, zero.data.id),
      )

      const negativeTerminal = await createTerminal(prisma, storeA, `negative-${suffix}`)
      await assert.rejects(
        () =>
          inStoreA(() =>
            service.openRegister(
              { terminalId: negativeTerminal, openingAmount: -0.01 },
              actorCashier,
              `open-negative-${suffix}`,
            ),
          ),
        /nao pode ser negativo/i,
      )
    })

    await t.test('4-6 abertura duplicada, concorrente e terminal de outra loja', async () => {
      await assert.rejects(
        () =>
          inStoreA(() =>
            service.openRegister(
              { terminalId: terminalMain, openingAmount: 0 },
              actorCashier,
              `open-duplicate-${suffix}`,
            ),
          ),
        ConflictException,
      )

      const raceTerminal = await createTerminal(prisma, storeA, `race-open-${suffix}`)
      const concurrent = await Promise.allSettled([
        inStoreA(() =>
          service.openRegister(
            { terminalId: raceTerminal, openingAmount: 20 },
            actorCashier,
            `open-race-a-${suffix}`,
          ),
        ),
        inStoreA(() =>
          service.openRegister(
            { terminalId: raceTerminal, openingAmount: 20 },
            actorCashier,
            `open-race-b-${suffix}`,
          ),
        ),
      ])
      assert.equal(concurrent.filter((entry) => entry.status === 'fulfilled').length, 1)
      assert.equal(
        await prisma.cashRegister.count({ where: { terminalId: raceTerminal, status: 'open' } }),
        1,
      )

      await assert.rejects(
        () =>
          inStoreA(() =>
            service.openRegister(
              { terminalId: terminalOtherStore, openingAmount: 20 },
              actorCashier,
              `open-cross-store-${suffix}`,
            ),
          ),
        /invalido para esta loja/i,
      )
    })

    await t.test('8-9 adicao de dinheiro e retry sem duplicidade', async () => {
      const supplied = await inStoreA(() =>
        service.supplyRegister(
          mainRegisterId,
          { amount: 50, reason: 'Troco adicional' },
          actorCashier,
          `supply-main-${suffix}`,
        ),
      )
      assert.equal(supplied.data.expectedAmount, 200)

      const retryKey = `supply-retry-${suffix}`
      await inStoreA(() =>
        service.supplyRegister(
          mainRegisterId,
          { amount: 5, reason: 'Moedas para troco' },
          actorCashier,
          retryKey,
        ),
      )
      await assert.rejects(() =>
        inStoreA(() =>
          service.supplyRegister(
            mainRegisterId,
            { amount: 5, reason: 'Moedas para troco' },
            actorCashier,
            retryKey,
          ),
        ),
      )
      assert.equal(
        await prisma.cashMovement.count({ where: { cashRegisterId: mainRegisterId, idempotencyKey: retryKey } }),
        1,
      )
    })

    await t.test('10-15 retirada, saldo, concorrencia e aprovacao configuravel', async () => {
      const withdrawn = await inStoreA(() =>
        service.withdrawRegister(
          mainRegisterId,
          { amount: 30, reason: 'Pagamento de despesa ficticia' },
          actorCashier,
          `withdraw-main-${suffix}`,
        ),
      )
      assert.equal(withdrawn.data.expectedAmount, 175)

      await assert.rejects(() =>
        inStoreA(() =>
          service.withdrawRegister(
            mainRegisterId,
            { amount: 1000, reason: 'Valor acima do saldo' },
            actorCashier,
            `withdraw-over-${suffix}`,
          ),
        ),
      )

      const concurrentTerminal = await createTerminal(prisma, storeA, `race-withdraw-${suffix}`)
      const concurrentRegister = await inStoreA(() =>
        service.openRegister(
          { terminalId: concurrentTerminal, openingAmount: 100 },
          actorCashier,
          `open-race-withdraw-${suffix}`,
        ),
      )
      const withdrawals = await Promise.allSettled([
        inStoreA(() =>
          service.withdrawRegister(
            concurrentRegister.data.id,
            { amount: 80, reason: 'Retirada concorrente A' },
            actorCashier,
            `withdraw-race-a-${suffix}`,
          ),
        ),
        inStoreA(() =>
          service.withdrawRegister(
            concurrentRegister.data.id,
            { amount: 80, reason: 'Retirada concorrente B' },
            actorCashier,
            `withdraw-race-b-${suffix}`,
          ),
        ),
      ])
      assert.equal(withdrawals.filter((entry) => entry.status === 'fulfilled').length, 1)
      assert.equal((await prisma.cashRegister.findUniqueOrThrow({ where: { id: concurrentRegister.data.id } })).expectedAmount.toNumber(), 20)

      await prisma.store.update({
        where: { id: storeA },
        data: { cashWithdrawalApprovalThreshold: 25 },
      })
      await assert.rejects(
        () =>
          inStoreA(() =>
            service.withdrawRegister(
              mainRegisterId,
              { amount: 30, reason: 'Retirada acima do limite' },
              actorCashier,
              `withdraw-needs-approval-${suffix}`,
            ),
          ),
        ForbiddenException,
      )
      const approved = await inStoreA(() =>
        service.withdrawRegister(
          mainRegisterId,
          { amount: 30, reason: 'Retirada autorizada pela gerente' },
          actorManager,
          `withdraw-approved-${suffix}`,
        ),
      )
      const approvedMovement = approved.data.movements.find(
        (entry) => entry.type === 'CASH_WITHDRAWAL' && entry.approvedByName === 'Marina Gestora',
      )
      assert.ok(approvedMovement)
      await prisma.store.update({
        where: { id: storeA },
        data: { cashWithdrawalApprovalThreshold: null },
      })
    })

    await t.test('16-22 venda, meios nao fisicos, reembolso, ajuste e saldo esperado', async () => {
      const scenarioTerminal = await createTerminal(prisma, storeA, `scenario-${suffix}`)
      const scenario = await inStoreA(() =>
        service.openRegister(
          { terminalId: scenarioTerminal, openingAmount: 150, note: 'Homologacao ficticia' },
          actorCashier,
          `open-scenario-${suffix}`,
        ),
      )
      const cashPayment = await createPaidOrder(prisma, {
        storeId: storeA,
        registerId: scenario.data.id,
        suffix: `cash-${suffix}`,
        method: 'cash',
        amount: 80,
      })
      await inStoreA(() =>
        service.recordCashSale({
          orderId: cashPayment.orderId,
          orderNumber: cashPayment.orderNumber,
          amount: 80,
          method: 'cash',
          paymentAuditId: cashPayment.auditId,
          sessionId: scenario.data.id,
          idempotencyKey: `cash-sale-${suffix}`,
        }),
      )

      await createPaidOrder(prisma, {
        storeId: storeA,
        registerId: scenario.data.id,
        suffix: `pix-${suffix}`,
        method: 'pix',
        amount: 45,
      })
      await createPaidOrder(prisma, {
        storeId: storeA,
        registerId: scenario.data.id,
        suffix: `card-${suffix}`,
        method: 'credit_card',
        amount: 25,
      })
      await inStoreA(() =>
        service.supplyRegister(
          scenario.data.id,
          { amount: 50, reason: 'Troco adicional ficticio' },
          actorCashier,
          `scenario-supply-${suffix}`,
        ),
      )
      await inStoreA(() =>
        service.withdrawRegister(
          scenario.data.id,
          { amount: 30, reason: 'Retirada ficticia' },
          actorCashier,
          `scenario-withdraw-${suffix}`,
        ),
      )

      const refund = await createRefundedCashOrder(prisma, {
        storeId: storeA,
        registerId: scenario.data.id,
        suffix: `refund-${suffix}`,
        amount: 10,
      })
      await inStoreA(() =>
        service.recordCashRefund({
          orderId: refund.orderId,
          orderNumber: refund.orderNumber,
          amount: 10,
          reason: 'Reembolso ficticio autorizado',
          authUser: actorCashier,
          paymentAuditId: refund.refundAuditId,
          sessionId: scenario.data.id,
          idempotencyKey: `cash-refund-${suffix}`,
        }),
      )
      await assert.rejects(() =>
        inStoreA(() =>
          service.recordCashRefund({
            orderId: refund.orderId,
            orderNumber: refund.orderNumber,
            amount: 10,
            reason: 'Retry do reembolso ficticio',
            authUser: actorCashier,
            paymentAuditId: refund.refundAuditId,
            sessionId: scenario.data.id,
            idempotencyKey: `cash-refund-${suffix}`,
          }),
        ),
      )

      const refreshed = await inStoreA(() => service.getRegister(scenario.data.id))
      assert.equal(refreshed.data.expectedAmount, 240)
      assert.equal(refreshed.data.entriesByMethod.cash, 80)
      assert.equal(refreshed.data.entriesByMethod.pix, 45)
      assert.equal(refreshed.data.entriesByMethod.credit_card, 25)
      assert.equal(
        refreshed.data.movements.filter((entry) => entry.type === 'CASH_REFUND').length,
        1,
      )

      const sourceMovement = refreshed.data.movements.find((entry) => entry.type === 'CASH_SUPPLY')
      assert.ok(sourceMovement)
      const adjustment = await inStoreA(() =>
        service.adjustRegister(
          scenario.data.id,
          {
            originalMovementId: sourceMovement.id,
            amount: 5,
            direction: 'increase',
            reason: 'Correcao compensatoria ficticia',
          },
          actorCashier,
          `cash-adjust-${suffix}`,
        ),
      )
      assert.equal(adjustment.data.expectedAmount, 245)
      const compensating = adjustment.data.movements.find((entry) => entry.type === 'CASH_ADJUSTMENT')
      assert.equal(compensating?.originalMovementId, sourceMovement.id)

      await inStoreA(() =>
        service.adjustRegister(
          scenario.data.id,
          {
            originalMovementId: compensating!.id,
            amount: 5,
            direction: 'decrease',
            reason: 'Retorno ao cenario de homologacao',
          },
          actorCashier,
          `cash-adjust-reverse-${suffix}`,
        ),
      )
      const exact = await inStoreA(() =>
        service.closeRegister(
          { countedAmount: 240, note: 'Fechamento exato' },
          actorCashier,
          `close-exact-${suffix}`,
          scenario.data.id,
        ),
      )
      assert.equal(exact.data.differenceAmount, 0)
    })

    await t.test('23-29 fechamento, diferencas, duplicidade, bloqueio e refresh', async () => {
      const positiveTerminal = await createTerminal(prisma, storeA, `positive-${suffix}`)
      const positive = await inStoreA(() =>
        service.openRegister(
          { terminalId: positiveTerminal, openingAmount: 10 },
          actorCashier,
          `open-positive-${suffix}`,
        ),
      )
      await assert.rejects(() =>
        inStoreA(() =>
          service.closeRegister(
            { countedAmount: 11 },
            actorCashier,
            `close-positive-no-reason-${suffix}`,
            positive.data.id,
          ),
        ),
      )
      const closedPositive = await inStoreA(() =>
        service.closeRegister(
          { countedAmount: 11, differenceReason: 'Sobra ficticia de homologacao' },
          actorCashier,
          `close-positive-${suffix}`,
          positive.data.id,
        ),
      )
      assert.equal(closedPositive.data.differenceAmount, 1)

      const negativeTerminal = await createTerminal(prisma, storeA, `negative-close-${suffix}`)
      const negative = await inStoreA(() =>
        service.openRegister(
          { terminalId: negativeTerminal, openingAmount: 10 },
          actorCashier,
          `open-negative-close-${suffix}`,
        ),
      )
      const closedNegative = await inStoreA(() =>
        service.closeRegister(
          { countedAmount: 5, differenceReason: 'Falta ficticia de homologacao' },
          actorCashier,
          `close-negative-${suffix}`,
          negative.data.id,
        ),
      )
      assert.equal(closedNegative.data.differenceAmount, -5)
      await assert.rejects(
        () =>
          inStoreA(() =>
            service.closeRegister(
              { countedAmount: 5, differenceReason: 'Retry' },
              actorCashier,
              `close-negative-${suffix}`,
              negative.data.id,
            ),
          ),
        NotFoundException,
      )
      await assert.rejects(() =>
        inStoreA(() =>
          service.supplyRegister(
            negative.data.id,
            { amount: 1, reason: 'Movimento tardio' },
            actorCashier,
            `late-movement-${suffix}`,
          ),
        ),
      )
      const refreshed = await inStoreA(() => service.getRegister(negative.data.id))
      assert.equal(refreshed.data.status, 'closed')
      assert.equal(refreshed.data.differenceAmount, -5)
    })

    await t.test('30-35 isolamento, auditoria, constraints, erros e precisao', async () => {
      await assert.rejects(
        () => inStoreB(() => service.getRegister(mainRegisterId)),
        NotFoundException,
      )

      const auditCount = await prisma.cashAuditLog.count({
        where: { storeId: storeA, cashRegisterId: mainRegisterId },
      })
      assert.ok(auditCount >= 4)
      assert.equal(
        await prisma.cashAuditLog.count({
          where: { storeId: storeA, cashRegisterId: mainRegisterId, cashMovementId: { not: null } },
        }) > 0,
        true,
      )

      const immutableMovement = await prisma.cashMovement.findFirstOrThrow({
        where: { cashRegisterId: mainRegisterId },
      })
      await assert.rejects(() =>
        prisma.cashMovement.update({
          where: { id: immutableMovement.id },
          data: { amount: 999 },
        }),
      )

      let sanitized = ''
      try {
        await inStoreA(() =>
          service.openRegister(
            { terminalId: terminalMain, openingAmount: 1 },
            actorCashier,
            `sanitized-${suffix}`,
          ),
        )
      } catch (error) {
        sanitized = error instanceof Error ? error.message : String(error)
      }
      assert.ok(sanitized)
      assert.doesNotMatch(sanitized, /cash_registers|SELECT|INSERT|P2002/i)

      const centsTerminal = await createTerminal(prisma, storeA, `cents-${suffix}`)
      const cents = await inStoreA(() =>
        service.openRegister(
          { terminalId: centsTerminal, openingAmount: 0.1 },
          actorCashier,
          `open-cents-${suffix}`,
        ),
      )
      const withCents = await inStoreA(() =>
        service.supplyRegister(
          cents.data.id,
          { amount: 0.2, reason: 'Teste de centavos' },
          actorCashier,
          `supply-cents-${suffix}`,
        ),
      )
      assert.equal(withCents.data.expectedAmount, 0.3)

      const withDifference = await inStoreA(() =>
        service.listHistory({ status: 'closed', difference: 'with', operator: 'Sara' }),
      )
      assert.ok(withDifference.data.every((register) => register.differenceAmount !== 0))
      assert.ok(withDifference.data.length >= 2)
    })
  } finally {
    await cleanup(prisma, [storeA, storeB], createdUserIds)
    await prisma.$disconnect()
  }
})

function actor(input: {
  id: string
  storeId: string
  name: string
  role: AuthenticatedRequestUser['role']
}): AuthenticatedRequestUser {
  return {
    sub: input.id,
    email: `${input.id}@example.invalid`,
    name: input.name,
    storeId: input.storeId,
    role: input.role,
    permissions: ['cash:view', 'cash:manage'],
  }
}

async function createFixture(
  prisma: PrismaClient,
  input: {
    storeA: string
    storeB: string
    cashierId: string
    managerId: string
    terminalMain: string
    terminalOtherStore: string
  },
) {
  await prisma.store.createMany({
    data: [
      storeData(input.storeA, 'Restaurante Laboratorio'),
      storeData(input.storeB, 'Restaurante Laboratorio B'),
    ],
  })
  await prisma.user.create({
    data: {
      id: input.cashierId,
      name: 'Sara Vale',
      email: `${input.cashierId}@example.invalid`,
      passwordHash: 'not-used-in-integration-test',
      stores: { create: { storeId: input.storeA, role: 'cashier' } },
    },
  })
  await prisma.user.create({
    data: {
      id: input.managerId,
      name: 'Marina Gestora',
      email: `${input.managerId}@example.invalid`,
      passwordHash: 'not-used-in-integration-test',
      stores: { create: { storeId: input.storeA, role: 'manager' } },
    },
  })
  await prisma.cashTerminal.createMany({
    data: [
      { id: input.terminalMain, storeId: input.storeA, code: 'main', name: 'Caixa principal' },
      { id: input.terminalOtherStore, storeId: input.storeB, code: 'main', name: 'Caixa principal' },
    ],
  })
}

function storeData(id: string, name: string) {
  return {
    id,
    name,
    tradeName: name,
    city: 'Manaus',
    state: 'AM',
    brandAccent: '#111111',
  }
}

async function createTerminal(prisma: PrismaClient, storeId: string, code: string) {
  const terminal = await prisma.cashTerminal.create({
    data: { storeId, code, name: `Caixa ${code}` },
  })
  return terminal.id
}

async function createPaidOrder(
  prisma: PrismaClient,
  input: {
    storeId: string
    registerId: string
    suffix: string
    method: PaymentMethod
    amount: number
  },
) {
  const orderId = `order-${input.suffix}`
  const orderNumber = `#${input.suffix}`
  const order = await prisma.order.create({
    data: {
      id: orderId,
      storeId: input.storeId,
      number: orderNumber,
      customerName: 'Cliente Laboratorio',
      customerPhone: '0000000000',
      source: 'counter',
      serviceType: 'counter',
      status: 'completed',
      paymentMethod: input.method,
      paymentStatus: 'paid',
      total: input.amount,
      subtotal: input.amount,
      dueAt: new Date(Date.now() + 60_000),
      paymentAudits: {
        create: {
          storeId: input.storeId,
          status: 'paid',
          amount: input.amount,
          method: input.method,
          source: 'integration-test',
          actorName: 'Sara Vale',
          cashRegisterId: input.registerId,
        },
      },
    },
    include: { paymentAudits: true },
  })
  return { orderId, orderNumber, auditId: order.paymentAudits[0]!.id }
}

async function createRefundedCashOrder(
  prisma: PrismaClient,
  input: { storeId: string; registerId: string; suffix: string; amount: number },
) {
  const orderId = `order-${input.suffix}`
  const orderNumber = `#${input.suffix}`
  const order = await prisma.order.create({
    data: {
      id: orderId,
      storeId: input.storeId,
      number: orderNumber,
      customerName: 'Cliente Laboratorio',
      customerPhone: '0000000000',
      source: 'counter',
      serviceType: 'counter',
      status: 'completed',
      paymentMethod: 'cash',
      paymentStatus: 'refunded',
      total: input.amount,
      subtotal: input.amount,
      dueAt: new Date(Date.now() + 60_000),
      paymentAudits: {
        create: [
          {
            storeId: input.storeId,
            status: 'paid',
            amount: input.amount,
            method: 'cash',
            source: 'integration-test',
            actorName: 'Sara Vale',
          },
          {
            storeId: input.storeId,
            status: 'refunded',
            amount: input.amount,
            method: 'cash',
            source: 'integration-test',
            actorName: 'Sara Vale',
            cashRegisterId: input.registerId,
          },
        ],
      },
    },
    include: { paymentAudits: true },
  })
  return {
    orderId,
    orderNumber,
    refundAuditId: order.paymentAudits.find((audit) => audit.status === 'refunded')!.id,
  }
}

async function cleanup(prisma: PrismaClient, storeIds: string[], userIds: string[]) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SET LOCAL app.cash_allow_mutation = 'on'`)
    await transaction.cashAuditLog.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.cashMovement.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.paymentAudit.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.order.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.cashRegister.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.cashTerminal.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.storeUser.deleteMany({ where: { storeId: { in: storeIds } } })
    await transaction.store.deleteMany({ where: { id: { in: storeIds } } })
    await transaction.user.deleteMany({ where: { id: { in: userIds } } })
  })
}

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? ''
  assert.match(databaseUrl, /127\.0\.0\.1|localhost/)
  assert.match(databaseUrl, /accdel_.*test/)
  assert.doesNotMatch(databaseUrl, /:55433\//)
}
