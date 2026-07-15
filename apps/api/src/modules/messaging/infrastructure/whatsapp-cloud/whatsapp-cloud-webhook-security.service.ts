import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { WhatsappCloudConfig } from './whatsapp-cloud.config'

@Injectable()
export class WhatsappCloudWebhookSecurityService {
  constructor(private readonly config: WhatsappCloudConfig) {}

  verifyChallenge(mode?: string, token?: string, challenge?: string) {
    if (!this.config.isEnabled()) {
      throw new NotFoundException()
    }

    if (
      mode !== 'subscribe' ||
      !token ||
      !constantTimeTextEqual(token, this.config.verifyToken) ||
      typeof challenge !== 'string'
    ) {
      throw new UnauthorizedException('Falha na verificacao do webhook da Meta.')
    }

    return challenge
  }

  verifySignature(input: {
    contentType?: string
    signature?: string | string[]
    rawBody?: Buffer
  }) {
    if (!this.config.isEnabled()) {
      throw new NotFoundException()
    }

    if (!input.contentType?.toLowerCase().startsWith('application/json')) {
      throw new UnsupportedMediaTypeException('O webhook aceita somente application/json.')
    }

    if (!input.rawBody) {
      throw new UnauthorizedException('Corpo bruto indisponivel para validar a assinatura.')
    }

    const header = Array.isArray(input.signature) ? input.signature[0] : input.signature
    verifyMetaSignature(input.rawBody, header, this.config.appSecret)
  }
}

export function verifyMetaSignature(rawBody: Buffer, signature: string | undefined, secret: string) {
  if (!signature?.startsWith('sha256=')) {
    throw new UnauthorizedException('Assinatura do webhook ausente ou invalida.')
  }

  const receivedHex = signature.slice('sha256='.length)
  if (!/^[a-f\d]{64}$/i.test(receivedHex)) {
    throw new UnauthorizedException('Assinatura do webhook ausente ou invalida.')
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const received = Buffer.from(receivedHex, 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new UnauthorizedException('Assinatura do webhook ausente ou invalida.')
  }
}

function constantTimeTextEqual(left: string, right: string) {
  const leftDigest = createHmac('sha256', 'cain-webhook-token').update(left).digest()
  const rightDigest = createHmac('sha256', 'cain-webhook-token').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}
