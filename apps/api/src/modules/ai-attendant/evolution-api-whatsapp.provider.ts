import { HttpException, HttpStatus } from '@nestjs/common'
import {
  WhatsappProviderAdapter,
  WhatsappSessionResult,
  WhatsappQrCodeResult,
  WhatsappStatusResult,
  WhatsappSendResult,
  WhatsappWebhookResult,
} from './whatsapp-provider.adapter'

export class EvolutionApiWhatsappProvider implements WhatsappProviderAdapter {
  readonly providerName = 'evolution_api'

  constructor(
    private readonly baseUrl?: string,
    private readonly apiKey?: string,
  ) {}

  private checkConfig() {
    if (!this.baseUrl || !this.apiKey) {
      throw new HttpException(
        'Integração com Evolution API pendente de configuração (.env). Preencha WHATSAPP_PROVIDER_BASE_URL e WHATSAPP_PROVIDER_API_KEY.',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  async startSession(storeId: string, sessionName: string): Promise<WhatsappSessionResult> {
    this.checkConfig()
    try {
      const response = await fetch(`${this.baseUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey || '',
        },
        body: JSON.stringify({
          instanceName: sessionName,
          token: storeId,
          qrcode: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Evolution API responded with status ${response.status}`)
      }

      const data = (await response.json()) as {
        instance?: { instanceName: string; status: string }
        qrcode?: { code: string }
      }

      return {
        sessionId: data.instance?.instanceName || sessionName,
        status: data.instance?.status === 'open' ? 'connected' : 'waiting_qr',
      }
    } catch (error) {
      const err = error as Error
      return {
        sessionId: sessionName,
        status: 'error',
        message: err.message,
      }
    }
  }

  async getQrCode(sessionId: string): Promise<WhatsappQrCodeResult> {
    this.checkConfig()
    try {
      const response = await fetch(`${this.baseUrl}/instance/connect/${sessionId}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey || '',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch QR code: status ${response.status}`)
      }

      const data = (await response.json()) as {
        code?: string
        base64?: string
        status?: string
      }

      if (data.status === 'open') {
        return {
          qrCode: null,
          expiresAt: null,
          status: 'connected',
        }
      }

      return {
        qrCode: data.base64 || data.code || null,
        expiresAt: new Date(Date.now() + 40 * 1000).toISOString(), // Evolution API default expiration is usually ~40s
        status: data.code ? 'waiting_qr' : 'error',
      }
    } catch (error) {
      const err = error as Error
      return {
        qrCode: null,
        expiresAt: null,
        status: 'error',
        message: err.message,
      }
    }
  }

  async getStatus(sessionId: string): Promise<WhatsappStatusResult> {
    this.checkConfig()
    try {
      const response = await fetch(`${this.baseUrl}/instance/connectionState/${sessionId}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey || '',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'disconnected', lastError: 'Session not found on provider.' }
        }
        throw new Error(`Failed to check status: status ${response.status}`)
      }

      const data = (await response.json()) as {
        instance?: {
          state: 'open' | 'connecting' | 'close' | 'refused'
          phone?: string
          name?: string
        }
      }

      const state = data.instance?.state
      let status: 'disconnected' | 'waiting_qr' | 'connecting' | 'connected' | 'expired' | 'error' = 'disconnected'

      if (state === 'open') status = 'connected'
      else if (state === 'connecting') status = 'connecting'
      else if (state === 'refused') status = 'error'

      return {
        status,
        phoneNumber: data.instance?.phone,
        displayName: data.instance?.name,
      }
    } catch (error) {
      const err = error as Error
      return {
        status: 'error',
        lastError: err.message,
      }
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    this.checkConfig()
    const response = await fetch(`${this.baseUrl}/instance/logout/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'apikey': this.apiKey || '',
      },
    })
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to disconnect: status ${response.status}`)
    }
  }

  async restartSession(sessionId: string): Promise<WhatsappSessionResult> {
    this.checkConfig()
    const response = await fetch(`${this.baseUrl}/instance/restart/${sessionId}`, {
      method: 'POST',
      headers: {
        'apikey': this.apiKey || '',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to restart instance: status ${response.status}`)
    }
    return {
      sessionId,
      status: 'connecting',
    }
  }

  async sendMessage(
    sessionId: string,
    to: string,
    message: string,
  ): Promise<WhatsappSendResult> {
    this.checkConfig()
    try {
      const normalizedTo = to.replace(/\D/g, '')
      const response = await fetch(`${this.baseUrl}/message/sendText/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey || '',
        },
        body: JSON.stringify({
          number: normalizedTo,
          options: {
            delay: 1200,
            presence: 'composing',
          },
          textMessage: {
            text: message,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Evolution API send failed: status ${response.status}`)
      }

      const data = (await response.json()) as {
        key?: { id: string }
      }

      return {
        messageId: data.key?.id || `msg_${Date.now()}`,
        status: 'sent',
      }
    } catch (error) {
      const err = error as Error
      return {
        messageId: '',
        status: 'failed',
        message: err.message,
      }
    }
  }

  async handleWebhook(payload: unknown): Promise<WhatsappWebhookResult> {
    // Normalization logic for Evolution API v1 / v2 Webhook structure
    const body = payload as {
      event?: string
      instance?: string
      data?: {
        key?: {
          remoteJid?: string
          id?: string
          fromMe?: boolean
        }
        pushName?: string
        message?: {
          conversation?: string
          extendedTextMessage?: { text: string }
        }
        messageTimestamp?: number
      }
    }

    const event = body.event || 'unknown'
    const sessionId = body.instance
    const fromMe = body.data?.key?.fromMe
    const pushName = body.data?.pushName

    const rawJid = body.data?.key?.remoteJid || ''
    const number = rawJid.split('@')[0] || ''

    let text = ''
    if (body.data?.message?.conversation) {
      text = body.data.message.conversation
    } else if (body.data?.message?.extendedTextMessage?.text) {
      text = body.data.message.extendedTextMessage.text
    }

    return {
      event,
      sessionId,
      from: fromMe ? 'store' : number,
      to: fromMe ? number : 'store',
      body: text,
      messageId: body.data?.key?.id,
      timestamp: body.data?.messageTimestamp,
      pushName,
    }
  }
}
