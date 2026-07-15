import assert from 'node:assert/strict'
import test from 'node:test'

import type { OrdersService } from '@/modules/orders/orders.service'
import type { PrismaService } from '@/shared/prisma/prisma.service'
import type { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { runWithStoreContext } from '@/shared/store-context'

import { DriversService } from './drivers.service'

test('consulta de motoboy sempre inclui a loja autenticada', async () => {
  let capturedWhere: Record<string, unknown> | undefined
  const prisma = {
    storeUser: {
      findFirst: ({ where }: { where: Record<string, unknown> }) => {
        capturedWhere = where
        return Promise.resolve(null)
      },
    },
  } as unknown as PrismaService
  const service = new DriversService(
    prisma,
    {} as OrdersService,
    {} as AdminRealtimeService,
  )

  await assert.rejects(() =>
    runWithStoreContext(
      { storeId: 'store-a', source: 'auth' },
      () => service.getDriverById('driver-from-store-b'),
    ),
  )
  assert.equal(capturedWhere?.storeId, 'store-a')
  assert.equal(capturedWhere?.userId, 'driver-from-store-b')
  assert.equal(capturedWhere?.role, 'driver')
})
