import { HttpException, HttpStatus } from '@nestjs/common'
import {
  WhatsappProviderAdapter,
  WhatsappSessionResult,
  WhatsappQrCodeResult,
  WhatsappStatusResult,
  WhatsappSendResult,
  WhatsappWebhookResult,
} from './whatsapp-provider.adapter'

export class UnconfiguredWhatsappProvider implements WhatsappProviderAdapter {
  readonly providerName = 'unconfigured'

  async startSession(): Promise<WhatsappSessionResult> {
    throw new HttpException(
      'Provider de WhatsApp não configurado. Use WHATSAPP_PROVIDER=cloud com as variáveis WHATSAPP_* da Meta, ou evolution_api com WHATSAPP_PROVIDER_BASE_URL e WHATSAPP_PROVIDER_API_KEY.',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  async getQrCode(): Promise<WhatsappQrCodeResult> {
    throw new HttpException(
      'Provider de WhatsApp não configurado nas variáveis de ambiente (.env).',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  async getStatus(): Promise<WhatsappStatusResult> {
    return {
      status: 'disconnected',
      lastError: 'Provider de WhatsApp não configurado nas variáveis de ambiente (.env).',
    }
  }

  async disconnect(): Promise<void> {
    throw new HttpException(
      'Provider de WhatsApp não configurado nas variáveis de ambiente (.env).',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  async restartSession(): Promise<WhatsappSessionResult> {
    throw new HttpException(
      'Provider de WhatsApp não configurado nas variáveis de ambiente (.env).',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  async sendMessage(): Promise<WhatsappSendResult> {
    throw new HttpException(
      'Provider de WhatsApp não configurado nas variáveis de ambiente (.env).',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  async handleWebhook(): Promise<WhatsappWebhookResult> {
    throw new HttpException(
      'Provider de WhatsApp não configurado nas variáveis de ambiente (.env).',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }
}
