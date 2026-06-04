import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AiProviderAdapter } from './ai-provider.adapter'
import { LovableBackendAiProvider } from './lovable-backend-ai.provider'
import { OpenAiCompatibleAiProvider } from './openai-compatible-ai.provider'
import { UnconfiguredAiProvider } from './unconfigured-ai.provider'

@Injectable()
export class AiProviderFactory {
  constructor(private readonly configService: ConfigService) {}

  getProvider(): AiProviderAdapter {
    const provider = this.configService.get<string>('AI_PROVIDER')?.trim()

    if (!provider) {
      return new UnconfiguredAiProvider()
    }

    if (provider === 'lovable_backend') {
      return this.createLovableBackendProvider()
    }

    if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      return this.createOpenAiCompatibleProvider(provider)
    }

    return new UnconfiguredAiProvider(
      `Provider de IA desconhecido: ${provider}. Configure AI_PROVIDER=groq, openai, openrouter ou lovable_backend.`,
    )
  }

  private createLovableBackendProvider(): AiProviderAdapter {
    const url = this.configService.get<string>('LOVABLE_BOT_REPLY_URL')?.trim()
    const secret = this.configService.get<string>('LOVABLE_BOT_REPLY_SECRET')?.trim()

    if (!url || !secret) {
      return new UnconfiguredAiProvider(
        'Provider de IA nao configurado. Configure LOVABLE_BOT_REPLY_URL e LOVABLE_BOT_REPLY_SECRET.',
      )
    }

    return new LovableBackendAiProvider(this.configService)
  }

  private createOpenAiCompatibleProvider(provider: 'openai' | 'groq' | 'openrouter'): AiProviderAdapter {
    const apiKey = this.configService.get<string>('AI_PROVIDER_API_KEY')?.trim()
    const model = this.configService.get<string>('AI_PROVIDER_MODEL')?.trim()

    if (!apiKey || !model) {
      return new UnconfiguredAiProvider(
        'Provider de IA nao configurado. Configure AI_PROVIDER_API_KEY e AI_PROVIDER_MODEL no ambiente da API.',
      )
    }

    const defaultBaseUrlByProvider = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      openrouter: 'https://openrouter.ai/api/v1',
    } satisfies Record<typeof provider, string>

    return new OpenAiCompatibleAiProvider(this.configService, {
      providerName: provider,
      defaultBaseUrl: defaultBaseUrlByProvider[provider],
    })
  }
}
