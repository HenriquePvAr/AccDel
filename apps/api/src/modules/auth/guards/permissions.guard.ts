import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from '../auth.constants'
import type { AdminPermission } from '../auth.permissions'
import type { AuthenticatedRequest } from '../auth.types'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<AdminPermission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []

    if (!requiredPermissions.length) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const currentPermissions = request.authUser?.permissions ?? []

    const hasAllPermissions = requiredPermissions.every((permission) =>
      currentPermissions.includes(permission),
    )

    if (!hasAllPermissions) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.')
    }

    return true
  }
}
