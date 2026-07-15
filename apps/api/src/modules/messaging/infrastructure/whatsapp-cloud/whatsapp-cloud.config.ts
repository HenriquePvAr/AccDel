import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WhatsappCloudConfig {
  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    const provider = this.config.get<string>('WHATSAPP_PROVIDER')?.trim()
    return provider === 'cloud' || provider === 'whatsapp_cloud'
  }

  get graphVersion() {
    return this.required('WHATSAPP_GRAPH_API_VERSION')
  }

  get phoneNumberId() {
    return this.required('WHATSAPP_PHONE_NUMBER_ID')
  }

  get businessAccountId() {
    return this.required('WHATSAPP_BUSINESS_ACCOUNT_ID')
  }

  get accessToken() {
    return this.required('WHATSAPP_ACCESS_TOKEN')
  }

  get verifyToken() {
    return this.required('WHATSAPP_VERIFY_TOKEN')
  }

  get appSecret() {
    return this.required('WHATSAPP_APP_SECRET')
  }

  get storeId() {
    return this.required('WHATSAPP_STORE_ID')
  }

  get timeoutMs() {
    return this.config.get<number>('WHATSAPP_HTTP_TIMEOUT_MS') ?? 10_000
  }

  get maxPayloadBytes() {
    return this.config.get<number>('WHATSAPP_WEBHOOK_MAX_PAYLOAD_BYTES') ?? 262_144
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim()
    if (!value) {
      throw new ServiceUnavailableException(`${name} nao esta configurada.`)
    }
    return value
  }
}
