import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { createHash } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import { catchError, from, map, mergeMap, Observable, of, throwError } from 'rxjs'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { DEFAULT_STORE_ID, STORE_ID_HEADER } from '@/shared/store-context'

import { IDEMPOTENCY_KEY, type IdempotencyOptions } from './idempotency.decorator'
import { IdempotencyService } from './idempotency.service'

type IdempotentRequest = FastifyRequest & {
  authUser?: AuthenticatedRequestUser
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<IdempotencyOptions>(IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!options) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<IdempotentRequest>()
    const rawKey = request.headers['idempotency-key']
    const key = (Array.isArray(rawKey) ? rawKey[0] : rawKey)?.trim()

    if (!key) {
      if (options.required !== false) {
        throw new BadRequestException('Envie o header Idempotency-Key nesta operacao.')
      }

      return next.handle()
    }

    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException('Idempotency-Key invalida.')
    }

    const actorId = request.authUser?.sub ?? `anonymous:${request.ip || 'unknown'}`
    const headerStore = request.headers[STORE_ID_HEADER]
    const storeId =
      request.authUser?.storeId ||
      (Array.isArray(headerStore) ? headerStore[0] : headerStore) ||
      DEFAULT_STORE_ID
    const requestHash = createHash('sha256')
      .update(
        stableStringify({
          method: request.method,
          path: request.routeOptions?.url ?? request.url,
          params: request.params,
          query: request.query,
          body: request.body,
        }),
      )
      .digest('hex')

    return from(
      this.idempotencyService.begin({
        storeId,
        actorId,
        operation: options.operation,
        key,
        requestHash,
        ttlMs: options.ttlMs ?? 24 * 60 * 60 * 1000,
      }),
    ).pipe(
      mergeMap((started) => {
        if (started.kind === 'replay') {
          return of(started.response)
        }

        return next.handle().pipe(
          mergeMap((response) =>
            from(this.idempotencyService.complete(started.recordId, response)).pipe(
              map(() => response),
            ),
          ),
          catchError((error: unknown) =>
            from(this.idempotencyService.abort(started.recordId)).pipe(
              mergeMap(() => throwError(() => error)),
            ),
          ),
        )
      }),
    )
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}
