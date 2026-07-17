import assert from 'node:assert/strict'
import test from 'node:test'

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'

import { resolveStoreContextFromRequest } from '@/shared/store-context'

import { PrintAgentAuthGuard } from './print-agent-auth.guard'
import { createAgentCredential } from './printing.utils'

test('token proprio autentica agente e fixa o contexto da loja', async () => {
  const credential = createAgentCredential()
  const request: Record<string, unknown> = {
    headers: { authorization: `Bearer ${credential.token}` },
    url: '/print-agent/heartbeat',
  }
  const guard = new PrintAgentAuthGuard({
    printAgent: {
      findUnique: async () => ({
        id: 'agent-a',
        storeId: 'store-a',
        name: 'Caixa local',
        version: '1.0.0',
        tokenHash: credential.tokenHash,
        enabled: true,
        revokedAt: null,
      }),
    },
  } as never)

  assert.equal(await guard.canActivate(contextFor(request)), true)
  assert.deepEqual(request.printAgent, {
    id: 'agent-a',
    storeId: 'store-a',
    name: 'Caixa local',
    version: '1.0.0',
  })
  const storeContext = resolveStoreContextFromRequest(request as never)
  assert.equal(storeContext.storeId, 'store-a')
  assert.equal(storeContext.source, 'agent')
})

test('token humano e agente revogado sao rejeitados', async () => {
  const humanGuard = new PrintAgentAuthGuard({} as never)
  await assert.rejects(
    () =>
      humanGuard.canActivate(
        contextFor({ headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' } }),
      ),
    UnauthorizedException,
  )

  const credential = createAgentCredential()
  const revokedGuard = new PrintAgentAuthGuard({
    printAgent: {
      findUnique: async () => ({
        id: 'agent-a',
        storeId: 'store-a',
        name: 'Revogado',
        version: null,
        tokenHash: credential.tokenHash,
        enabled: false,
        revokedAt: new Date(),
      }),
    },
  } as never)
  await assert.rejects(
    () =>
      revokedGuard.canActivate(
        contextFor({ headers: { authorization: `Bearer ${credential.token}` } }),
      ),
    UnauthorizedException,
  )
})

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}
