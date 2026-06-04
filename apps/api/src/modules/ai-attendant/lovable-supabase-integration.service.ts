import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

type LovableSupabaseKeyType = 'publishable' | 'missing' | 'unsupported'

export interface LovableSupabaseIntegrationStatus {
  configured: boolean
  projectId: string | null
  supabaseHost: string | null
  keyType: LovableSupabaseKeyType
  usedAsAiProvider: false
  missingVariables: string[]
  message: string
}

export interface LovableSupabaseConnectionStatus
  extends LovableSupabaseIntegrationStatus {
  reachable: boolean | null
  httpStatus: number | null
  lastError: string | null
}

@Injectable()
export class LovableSupabaseIntegrationService {
  constructor(private readonly configService: ConfigService) {}

  getStatus(): LovableSupabaseIntegrationStatus {
    const config = this.readConfig()
    return this.buildStatus(config)
  }

  async testConnection(): Promise<LovableSupabaseConnectionStatus> {
    const config = this.readConfig()
    const status = this.buildStatus(config)

    if (!status.configured || !config.url || !config.publishableKey) {
      return {
        ...status,
        reachable: null,
        httpStatus: null,
        lastError: status.message,
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(this.buildRestEndpoint(config.url), {
        method: 'GET',
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
        },
        signal: controller.signal,
      })

      return {
        ...status,
        reachable: response.ok,
        httpStatus: response.status,
        lastError: response.ok ? null : `Supabase returned HTTP ${response.status}.`,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown connection error.'

      return {
        ...status,
        reachable: false,
        httpStatus: null,
        lastError: message,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private readConfig() {
    return {
      url: this.readEnv('LOVABLE_SUPABASE_URL'),
      publishableKey: this.readEnv('LOVABLE_SUPABASE_PUBLISHABLE_KEY'),
      projectId: this.readEnv('LOVABLE_SUPABASE_PROJECT_ID'),
    }
  }

  private buildStatus(config: ReturnType<LovableSupabaseIntegrationService['readConfig']>) {
    const requiredVariables: [string, string | null][] = [
      ['LOVABLE_SUPABASE_URL', config.url],
      ['LOVABLE_SUPABASE_PUBLISHABLE_KEY', config.publishableKey],
      ['LOVABLE_SUPABASE_PROJECT_ID', config.projectId],
    ]

    const missingVariables = requiredVariables
      .filter(([, value]) => !value)
      .map(([name]) => name)

    const supabaseHost = this.parseHost(config.url)
    const keyType = this.resolveKeyType(config.publishableKey)
    const configured =
      missingVariables.length === 0 && supabaseHost !== null && keyType === 'publishable'

    return {
      configured,
      projectId: config.projectId,
      supabaseHost,
      keyType,
      usedAsAiProvider: false as const,
      missingVariables,
      message: this.resolveMessage(configured, supabaseHost, keyType, missingVariables),
    }
  }

  private readEnv(name: string): string | null {
    const value = this.configService.get<string>(name)
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }

  private resolveKeyType(value: string | null): LovableSupabaseKeyType {
    if (!value) {
      return 'missing'
    }

    return value.startsWith('sb_publishable_') ? 'publishable' : 'unsupported'
  }

  private parseHost(urlValue: string | null): string | null {
    if (!urlValue) {
      return null
    }

    try {
      return new URL(urlValue).host
    } catch {
      return null
    }
  }

  private buildRestEndpoint(urlValue: string): string {
    const url = new URL(urlValue)
    url.pathname = '/rest/v1/'
    url.search = ''
    url.hash = ''
    return url.toString()
  }

  private resolveMessage(
    configured: boolean,
    supabaseHost: string | null,
    keyType: LovableSupabaseKeyType,
    missingVariables: string[],
  ): string {
    if (missingVariables.length > 0) {
      return 'Lovable/Supabase opcional desativado. Configure LOVABLE_SUPABASE_URL, LOVABLE_SUPABASE_PUBLISHABLE_KEY e LOVABLE_SUPABASE_PROJECT_ID se quiser diagnosticar esse projeto.'
    }

    if (!supabaseHost) {
      return 'LOVABLE_SUPABASE_URL invalida. Use a URL publica do projeto Supabase.'
    }

    if (keyType !== 'publishable') {
      return 'LOVABLE_SUPABASE_PUBLISHABLE_KEY deve ser uma chave publica Supabase com prefixo sb_publishable_.'
    }

    if (configured) {
      return 'Lovable/Supabase configurado apenas para diagnostico. Nao e banco principal do Cain Delivery e nao e provider de IA.'
    }

    return 'Lovable/Supabase opcional nao configurado.'
  }
}
