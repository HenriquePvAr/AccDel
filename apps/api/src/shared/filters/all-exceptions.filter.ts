import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { FastifyReply } from 'fastify'
import { ZodError } from 'zod'

import type { CorrelatedRequest } from '@/shared/operations/request-observability.interceptor'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const response = context.getResponse<FastifyReply>()
    const request = context.getRequest<CorrelatedRequest>()
    const { statusCode, code, message, details } = this.normalizeException(exception)

    if (statusCode >= 500) {
      this.logger.error(JSON.stringify({
        event: 'http_request_failed',
        timestamp: new Date().toISOString(),
        correlationId: request.correlationId ?? null,
        path: request.routeOptions?.url ?? request.url.split('?')[0],
        statusCode,
        code,
        exceptionType: exception instanceof Error ? exception.name : 'UnknownError',
      }))
    }

    void response.status(statusCode).send({
      error: {
        code,
        message,
        details,
      },
      meta: {
        path: request.url.split('?')[0],
        correlationId: request.correlationId ?? null,
        timestamp: new Date().toISOString(),
      },
    })
  }

  private normalizeException(exception: unknown) {
    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Payload inválido.',
        details: exception.issues,
      }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus()
      const response = exception.getResponse()
      const message =
        typeof response === 'object' && response && 'message' in response
          ? String((response as { message: unknown }).message)
          : exception.message

      return {
        statusCode,
        code: exception.name,
        message,
        details: response,
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Registro não encontrado.',
          details: null,
        }
      }

      return {
        statusCode: HttpStatus.CONFLICT,
        code: exception.code,
        message: 'Erro de persistência.',
        details: null,
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro inesperado.',
      details: null,
    }
  }
}
