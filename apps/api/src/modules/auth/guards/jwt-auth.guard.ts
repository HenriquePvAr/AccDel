import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'

import { enterStoreContext } from '@/shared/store-context'

import { IS_PUBLIC_KEY } from '../auth.constants'
import type { AuthTokenPayload, AuthenticatedRequest } from '../auth.types'
import { readJwtSecret } from '../auth-secret'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: import('@nestjs/common').ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = this.extractToken(request)

    if (!token) {
      throw new UnauthorizedException('Sessão ausente. Faça login novamente.')
    }

    const secret = readJwtSecret(this.configService)

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret,
      })

      request.authUser = payload
      enterStoreContext({
        storeId: payload.storeId,
        source: 'auth',
      })
      return true
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.')
    }
  }

  private extractToken(request: FastifyRequest) {
    const authorization = request.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      return null
    }

    return authorization.slice(7)
  }
}
