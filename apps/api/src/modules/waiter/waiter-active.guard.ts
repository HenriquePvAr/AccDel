import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import type { AuthenticatedRequest } from '@/modules/auth/auth.types'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { FeatureFlagsService } from '@/shared/operations/feature-flags.service'

@Injectable()
export class WaiterActiveGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features?: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.features && !this.features.isEnabled('waiterPwa')) {
      throw new ForbiddenException('O aplicativo de garcom esta desativado neste ambiente.')
    }

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
