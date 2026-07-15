import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'

import { AppModule } from './app.module'
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: 262_144,
    }),
    { rawBody: true },
  )
  const config = app.get(ConfigService)
  const port = config.get<number>('API_PORT') ?? 3333
  const appEnvironment = config.get<string>('APP_ENV') ?? 'development'
  const configuredOrigins =
    config.get<string>('CORS_ALLOWED_ORIGINS') ?? config.get<string>('WEB_ORIGIN') ?? ''
  const developmentOrigins =
    appEnvironment === 'development' || appEnvironment === 'test'
      ? [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:4173',
          'http://127.0.0.1:4173',
        ]
      : []
  const allowedOrigins = Array.from(
    new Set([
      ...configuredOrigins.split(',').map((origin) => origin.trim()).filter(Boolean),
      ...developmentOrigins,
    ]),
  )

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`), false)
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )

  await app.listen(port, '0.0.0.0')
  Logger.log(
    JSON.stringify({
      event: 'api_started',
      service: 'cain-delivery-api',
      appEnvironment,
      port,
    }),
    'Bootstrap',
  )
}

void bootstrap()
