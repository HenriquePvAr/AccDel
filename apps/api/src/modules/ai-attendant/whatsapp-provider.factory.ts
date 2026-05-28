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

    if (provider === 'evolution_api') {
      return new EvolutionApiWhatsappProvider(baseUrl, apiKey)
    }

    // Default to unconfigured provider instead of fake mocks when no variables are set.
    return new UnconfiguredWhatsappProvider()
  }
}
