import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrismaService } from '@/shared/prisma/prisma.service'

import { IdempotencyService } from './idempotency.service'

test('repete o resultado persistido sem executar novamente', async () => {
  const records = new Map<string, Record<string, unknown>>()
  const prisma = {
    idempotencyRecord: {
      findUnique: ({ where }: { where: { storeId_actorId_operation_key: Record<string, string> } }) =>
        Promise.resolve(records.get(recordKey(where.storeId_actorId_operation_key)) ?? null),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const id = 'record-a'
        records.set(recordKey(data as Record<string, string>), { id, ...data })
        return Promise.resolve({ id, ...data })
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const [key, record] of records) {
          if (record.id === where.id) records.set(key, { ...record, ...data })
        }
        return Promise.resolve(data)
      },
      delete: () => Promise.resolve(null),
      deleteMany: () => Promise.resolve({ count: 0 }),
    },
  } as unknown as PrismaService
  const service = new IdempotencyService(prisma)
  const input = {
    storeId: 'store-a',
    actorId: 'user-a',
    operation: 'orders:create',
    key: 'request-key-a',
    requestHash: 'hash-a',
    ttlMs: 60_000,
  }
  const started = await service.begin(input)
  assert.equal(started.kind, 'started')
  if (started.kind === 'started') {
    await service.complete(started.recordId, { data: { id: 'order-a' } })
  }

  const replay = await service.begin(input)
  assert.deepEqual(replay, { kind: 'replay', response: { data: { id: 'order-a' } } })
  await assert.rejects(() => service.begin({ ...input, requestHash: 'hash-b' }))
})

function recordKey(record: Record<string, string>) {
  return `${record.storeId}:${record.actorId}:${record.operation}:${record.key}`
}
