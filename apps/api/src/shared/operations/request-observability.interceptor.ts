import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { Observable } from 'rxjs'

import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'

import { ObservabilityService } from './observability.service'

export interface CorrelatedRequest extends FastifyRequest {
  authUser?: AuthenticatedRequestUser
  correlationId?: string
}

@Injectable()
export class RequestObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest')

  constructor(private readonly observability: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const request = http.getRequest<CorrelatedRequest>()
    const response = http.getResponse<FastifyReply>()
    const correlationId = resolveCorrelationId(request.headers['x-correlation-id'])
    const route = resolveRoute(request)
    const area = resolveArea(route)
    const startedAt = performance.now()
    let finished = false

    request.correlationId = correlationId
    void response.header('x-correlation-id', correlationId)
    this.observability.requestStarted()

    const finish = (statusCode: number) => {
      if (finished) return
      finished = true
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
      this.observability.requestFinished(area, statusCode, durationMs)
      this.logger.log(JSON.stringify({
        event: 'http_request_completed',
        timestamp: new Date().toISOString(),
        correlationId,
        method: request.method,
        route,
        area,
        statusCode,
        durationMs,
        storeId: request.authUser?.storeId ?? null,
        role: request.authUser?.role ?? null,
      }))
    }

    return new Observable((subscriber) => {
      const subscription = next.handle().subscribe({
        next: (value: unknown) => subscriber.next(value),
        error: (error: unknown) => {
          finish(error instanceof HttpException ? error.getStatus() : 500)
          subscriber.error(error)
        },
        complete: () => {
          finish(response.statusCode)
          subscriber.complete()
        },
      })
      return () => subscription.unsubscribe()
    })
  }
}

export function resolveCorrelationId(header: string | string[] | undefined) {
  const candidate = Array.isArray(header) ? header[0] : header
  return candidate && /^[A-Za-z0-9_.:-]{8,128}$/.test(candidate)
    ? candidate
    : randomUUID()
}

function resolveRoute(request: FastifyRequest) {
  const route = request.routeOptions?.url
  if (route && route !== '*') return route
  return request.url.split('?')[0].replace(
    /\/[0-9a-f]{8}-[0-9a-f-]{27,}|\/[A-Za-z0-9_-]{40,80}/gi,
    '/:opaque',
  )
}

function resolveArea(route: string) {
  return route.split('/').filter(Boolean)[0] ?? 'root'
}
