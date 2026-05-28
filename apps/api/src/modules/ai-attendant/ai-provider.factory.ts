import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AiProviderAdapter } from './ai-provider.adapter'
import { UnconfiguredAiProvider } from './unconfigured-ai.provider'

@Injectable()
export class AiProviderFactory {
  constructor(private readonly configService: ConfigService) {}

  getProvider(): AiProviderAdapter {
    const provider = this.configService.get<string>('AI_PROVIDER')
    const apiKey = this.configService.get<string>('AI_PROVIDER_API_KEY')

    if (provider === 'lovable' && apiKey) {
      // In the future we will plug in the real Lovable AI Provider.
      // For now, if AI_PROVIDER is set but not fully integrated, we use unconfigured or throw.
      // But we will make a basic wrapper for it if they want. Let's return Unconfigured for now since we are in Discovery/Handoff.
      return new UnconfiguredAiProvider()
    }

    return new UnconfiguredAiProvider()
  }
}
