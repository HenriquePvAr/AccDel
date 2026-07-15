import assert from 'node:assert/strict'
import test from 'node:test'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { Reflector } from '@nestjs/core'
import type { JwtService } from '@nestjs/jwt'

import { getPermissionsForRole } from './auth.permissions'
import { PermissionsGuard } from './guards/permissions.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

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

function buildContext(request: object) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}
