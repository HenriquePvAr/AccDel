import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import type { AuthenticatedRequest } from '@/modules/auth/auth.types'
import { PrismaService } from '@/shared/prisma/prisma.service'

@Injectable()
export class WaiterActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authUser = request.authUser

    if (!authUser) {
      throw new UnauthorizedException('Sessao ausente. Faca login novamente.')
    }

    if (!['waiter', 'manager'].includes(authUser.role)) {
      throw new ForbiddenException('Este aplicativo e exclusivo para garcons e gerentes.')
    }

    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: authUser.storeId,
        userId: authUser.sub,
        role: authUser.role,
        active: true,
        user: {
          status: 'active',
        },
        ...(authUser.role === 'waiter'
          ? {
              waiterProfile: {
                active: true,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    })

    if (!membership) {
      throw new UnauthorizedException('Seu acesso a esta loja foi desativado ou alterado.')
    }

    return true
  }
}
