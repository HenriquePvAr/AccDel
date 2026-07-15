import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { MessagingAccount } from '@prisma/client'

import type { MessagingProvider } from '../domain/messaging-provider'
import { MessagingProviderError } from '../domain/messaging-provider'
import { EvolutionLegacyMessagingProvider } from '../infrastructure/evolution/evolution-legacy-messaging.provider'
import { WhatsappCloudProvider } from '../infrastructure/whatsapp-cloud/whatsapp-cloud.provider'

@Injectable()
export class MessagingProviderRouter {
  constructor(
    private readonly config: ConfigService,
    private readonly cloud: WhatsappCloudProvider,
    private readonly evolution: EvolutionLegacyMessagingProvider,
  ) {}

  forAccount(account: MessagingAccount): MessagingProvider {
    const selected = this.config.get<string>('WHATSAPP_PROVIDER')?.trim()

    if (
      account.provider === 'whatsapp_cloud' &&
      (selected === 'cloud' || selected === 'whatsapp_cloud')
    ) {
      return this.cloud
    }

    if (account.provider === 'evolution_legacy' && selected === 'evolution_api') {
      return this.evolution
    }

    throw new MessagingProviderError(
      'A conta nao corresponde ao provider explicitamente selecionado.',
      'provider_mismatch',
      false,
    )
  }
}
