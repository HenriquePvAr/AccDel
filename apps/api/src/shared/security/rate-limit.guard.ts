import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { DEFAULT_STORE_ID, STORE_ID_HEADER } from '@/shared/store-context'

import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator'
import { RateLimitService } from './rate-limit.service'

interface RateLimitedRequest extends FastifyRequest {
  authUser?: AuthenticatedRequestUser
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext) {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!options) {
      return true
    }

    const request = context.switchToHttp().getRequest<RateLimitedRequest>()
    const endpoint = `${request.method}:${request.routeOptions?.url ?? request.url}`
    const scopes = options.scopes ?? ['ip', 'user', 'store']
    const forwardedFor = request.headers['x-forwarded-for']
    const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
      ?.split(',')[0]
      ?.trim() || request.ip || 'unknown'
    const headerStore = request.headers[STORE_ID_HEADER]
    const storeId =
      request.authUser?.storeId ||
      (Array.isArray(headerStore) ? headerStore[0] : headerStore) ||
      DEFAULT_STORE_ID
    const dimensions = {
      ip,
      user: request.authUser?.sub ?? `anonymous:${ip}`,
      store: storeId,
    }
    const keys = scopes.map((scope) => `${endpoint}:${scope}:${dimensions[scope]}`)
    const decision = this.rateLimitService.consume(
      keys,
      options.limit,
      options.windowMs,
    )

    if (!decision.allowed) {
      throw new HttpException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas tentativas. Aguarde antes de tentar novamente.',
        retryAfterSeconds: decision.retryAfterSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS)
    }

    return true
  }
}
