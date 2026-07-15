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
  )
  const config = app.get(ConfigService)
  const port = config.get<number>('API_PORT') ?? 3333
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'
  const allowedOrigins = Array.from(
    new Set(
      webOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .concat([
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:4173',
          'http://127.0.0.1:4173',
        ]),
    ),
  )

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/localhost:\d+$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)
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
  Logger.log(`Cain Delivery API running on http://localhost:${port}`, 'Bootstrap')
}

void bootstrap()
