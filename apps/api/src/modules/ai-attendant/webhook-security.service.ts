import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, timingSafeEqual } from 'node:crypto'
import { FeatureFlagsService } from '@/shared/operations/feature-flags.service'

const messageEvents = new Set(['messagesupsert', 'messageupsert'])

export interface WebhookSecurityInput {
  contentType?: string
  authorization?: string
  token?: string
  payload: unknown
}

export interface WebhookSecurityOptions {
  secret: string
  maxPayloadBytes: number
  maxAgeSeconds: number
  now?: number
}

@Injectable()
export class WebhookSecurityService {
  constructor(
    private readonly configService: ConfigService,
    private readonly features?: FeatureFlagsService,
  ) {}

  assertValid(input: WebhookSecurityInput) {
    if (this.features && !this.features.isEnabled('whatsapp')) {
      throw new NotFoundException()
    }
    if (this.configService.get<string>('WHATSAPP_PROVIDER')?.trim() !== 'evolution_api') {
      throw new NotFoundException()
    }

    const secret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET')?.trim()

    if (!secret || secret.length < 24 || /change|example|placeholder/i.test(secret)) {
      throw new ServiceUnavailableException(
        'WHATSAPP_WEBHOOK_SECRET precisa ser configurado com segurança.',
      )
    }

    return verifyWebhookSecurity(input, {
      secret,
      maxPayloadBytes:
        this.configService.get<number>('WHATSAPP_WEBHOOK_MAX_PAYLOAD_BYTES') ?? 262_144,
      maxAgeSeconds:
        this.configService.get<number>('WHATSAPP_WEBHOOK_MAX_AGE_SECONDS') ?? 300,
    })
  }
}

export function verifyWebhookSecurity(
  input: WebhookSecurityInput,
  options: WebhookSecurityOptions,
) {
  if (!input.contentType?.toLowerCase().startsWith('application/json')) {
    throw new UnsupportedMediaTypeException('O webhook aceita somente application/json.')
  }

  const payloadBytes = Buffer.byteLength(JSON.stringify(input.payload ?? null), 'utf8')
  if (payloadBytes > options.maxPayloadBytes) {
    throw new PayloadTooLargeException('Payload do webhook excede o limite permitido.')
  }

  const bearer = input.authorization?.startsWith('Bearer ')
    ? input.authorization.slice(7).trim()
    : undefined
  const receivedToken = input.token?.trim() || bearer

  if (!receivedToken || !constantTimeEqual(receivedToken, options.secret)) {
    throw new UnauthorizedException('Token do webhook ausente ou invalido.')
  }

  const event = readString(input.payload, 'event') ?? 'unknown'
  const timestamp = readWebhookTimestamp(input.payload)

  if (isMessageWebhookEvent(event)) {
    if (!timestamp) {
      throw new BadRequestException('Evento de mensagem sem timestamp verificavel.')
    }

    const now = options.now ?? Date.now()
    const timestampMs = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
    const ageMs = now - timestampMs
    if (ageMs > options.maxAgeSeconds * 1000 || ageMs < -60_000) {
      throw new UnauthorizedException('Timestamp do webhook expirado ou invalido.')
    }
  }

  return { event, timestamp, payloadBytes }
}

export function isMessageWebhookEvent(event: string) {
  return messageEvents.has(event.toLowerCase().replace(/[^a-z]/g, ''))
}

function constantTimeEqual(left: string, right: string) {
  const leftDigest = createHash('sha256').update(left).digest()
  const rightDigest = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

function readWebhookTimestamp(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const root = payload as Record<string, unknown>
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : undefined
  const value = data?.messageTimestamp ?? data?.timestamp ?? root.timestamp

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }

  return null
}

function readString(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}
