import assert from 'node:assert/strict'
import test from 'node:test'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { Reflector } from '@nestjs/core'
import type { JwtService } from '@nestjs/jwt'
import type { PrismaService } from '@/shared/prisma/prisma.service'

import { getPermissionsForRole } from './auth.permissions'
import { PermissionsGuard } from './guards/permissions.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { WaiterActiveGuard } from '../waiter/waiter-active.guard'

test('motoboy recebe somente permissao self e nao acessa endpoint administrativo', () => {
  const permissions = getPermissionsForRole('driver')
  assert.deepEqual(permissions, ['drivers:self'])
  assert.equal(permissions.includes('drivers:view'), false)
  assert.equal(permissions.includes('settings:delivery:manage'), false)

  const reflector = {
    getAllAndOverride: (key: string) =>
      key === 'isPublic' ? false : ['settings:delivery:manage'],
  } as unknown as Reflector
  const guard = new PermissionsGuard(reflector)
  const context = buildContext({ authUser: { permissions } })

  assert.throws(() => guard.canActivate(context), ForbiddenException)
})

test('token invalido ou expirado e rejeitado antes do controller', async () => {
  const reflector = {
    getAllAndOverride: () => false,
  } as unknown as Reflector
  const config = {
    get: () => 'jwt-secret-with-more-than-thirty-two-random-characters',
  } as unknown as ConfigService

  for (const reason of ['invalid signature', 'jwt expired']) {
    const jwt = {
      verifyAsync: () => Promise.reject(new Error(reason)),
    } as unknown as JwtService
    const guard = new JwtAuthGuard(reflector, jwt, config)
    const context = buildContext({ headers: { authorization: 'Bearer invalid-token' } })

    await assert.rejects(() => guard.canActivate(context), UnauthorizedException)
  }
})

test('garcom recebe somente permissoes operacionais do PWA', () => {
  const permissions = getPermissionsForRole('waiter')

  assert.equal(permissions.includes('waiter:tables:view'), true)
  assert.equal(permissions.includes('waiter:orders:send'), true)
  assert.equal(permissions.includes('dining:update'), false)
  assert.equal(permissions.includes('orders:update'), false)
  assert.equal(permissions.includes('catalog:products:manage'), false)
  assert.equal(permissions.includes('printing:manage'), false)
})

test('caixa fecha sessao sem receber permissao ampla de edicao do salao', () => {
  const permissions = getPermissionsForRole('cashier')

  assert.equal(permissions.includes('payments:confirm'), true)
  assert.equal(permissions.includes('dining:sessions:close'), true)
  assert.equal(permissions.includes('dining:update'), false)
})

test('usuario sem cash manage nao abre nem movimenta caixa', () => {
  const permissions = getPermissionsForRole('attendant')
  const reflector = {
    getAllAndOverride: (key: string) => (key === 'isPublic' ? false : ['cash:manage']),
  } as unknown as Reflector
  const guard = new PermissionsGuard(reflector)

  assert.equal(permissions.includes('cash:manage'), false)
  assert.throws(
    () => guard.canActivate(buildContext({ authUser: { permissions } })),
    ForbiddenException,
  )
})

test('PWA invalida imediatamente vinculo desativado ou papel alterado', async () => {
  const prisma = {
    storeUser: {
      findFirst: () => Promise.resolve(null),
    },
  } as unknown as PrismaService
  const guard = new WaiterActiveGuard(prisma)
  const context = buildContext({
    authUser: {
      sub: 'user-waiter',
      storeId: 'store-a',
      role: 'waiter',
      permissions: getPermissionsForRole('waiter'),
    },
  })

  await assert.rejects(() => guard.canActivate(context), UnauthorizedException)
})

function buildContext(request: object) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}
