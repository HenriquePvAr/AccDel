import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiConversation, CustomerChannelIdentity } from '@prisma/client'

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1_000

@Injectable()
export class ConversationWindowService {
  isFreeFormAllowed(
    source: Pick<AiConversation, 'lastInboundAt'> | Pick<CustomerChannelIdentity, 'lastInboundAt'>,
    now = new Date(),
  ) {
    return Boolean(
      source.lastInboundAt &&
        now.getTime() - source.lastInboundAt.getTime() >= 0 &&
        now.getTime() - source.lastInboundAt.getTime() < CUSTOMER_SERVICE_WINDOW_MS,
    )
  }

  assertFreeFormAllowed(
    source: Pick<AiConversation, 'lastInboundAt'> | Pick<CustomerChannelIdentity, 'lastInboundAt'>,
    now = new Date(),
  ) {
    if (!this.isFreeFormAllowed(source, now)) {
      throw new BadRequestException(
        'A janela de atendimento de 24 horas expirou; use um template aprovado.',
      )
    }
  }
}

export { CUSTOMER_SERVICE_WINDOW_MS }
