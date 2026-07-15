import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WhatsappProviderAdapter } from './whatsapp-provider.adapter'
import { UnconfiguredWhatsappProvider } from './unconfigured-whatsapp.provider'
import { EvolutionApiWhatsappProvider } from './evolution-api-whatsapp.provider'

@Injectable()
export class WhatsappProviderFactory {
  constructor(private readonly configService: ConfigService) {}

  getProvider(): WhatsappProviderAdapter {
    const provider = this.configService.get<string>('WHATSAPP_PROVIDER')
    const baseUrl = this.configService.get<string>('WHATSAPP_PROVIDER_BASE_URL')
    const apiKey = this.configService.get<string>('WHATSAPP_PROVIDER_API_KEY')
    const webhookUrl = this.configService.get<string>('WHATSAPP_PROVIDER_WEBHOOK_URL')
    const webhookSecret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET')
    const integration = this.configService.get<string>('WHATSAPP_PROVIDER_INTEGRATION')

    if (provider === 'evolution_api') {
      return new EvolutionApiWhatsappProvider(baseUrl, apiKey, {
        webhookUrl: buildSecuredWebhookUrl(webhookUrl, webhookSecret),
        integration:
          integration === 'WHATSAPP-BUSINESS' || integration === 'WHATSAPP-BAILEYS'
            ? integration
            : 'WHATSAPP-BAILEYS',
      })
    }

    // Default to unconfigured provider instead of fake mocks when no variables are set.
    return new UnconfiguredWhatsappProvider()
  }
}

function buildSecuredWebhookUrl(webhookUrl?: string, secret?: string) {
  if (!webhookUrl?.trim() || !secret?.trim()) {
    return undefined
  }

  const url = new URL(webhookUrl)
  url.searchParams.set('webhook_secret', secret.trim())
  return url.toString()
}
