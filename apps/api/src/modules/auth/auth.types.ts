import type { AdminRole } from '@prisma/client'
import type { FastifyRequest } from 'fastify'

import type { AdminPermission } from './auth.permissions'

export interface AuthenticatedRequestUser {
  sub: string
  email: string
  name: string
  storeId: string
  role: AdminRole
  permissions: AdminPermission[]
}

export type AuthTokenPayload = AuthenticatedRequestUser

export interface AuthenticatedRequest extends FastifyRequest {
  authUser?: AuthenticatedRequestUser
}
