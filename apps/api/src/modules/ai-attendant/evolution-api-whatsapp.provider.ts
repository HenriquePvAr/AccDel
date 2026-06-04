import { HttpException, HttpStatus } from '@nestjs/common'
import {
  WhatsappProviderAdapter,
  WhatsappSessionResult,
  WhatsappQrCodeResult,
  WhatsappStatusResult,
  WhatsappSendResult,
  WhatsappWebhookResult,
} from './whatsapp-provider.adapter'

const EVOLUTION_WEBHOOK_EVENTS = [
  'QRCODE_UPDATED',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'SEND_MESSAGE',
  'CONNECTION_UPDATE',
]

interface EvolutionApiProviderOptions {
  webhookUrl?: string
  integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS'
}

export class EvolutionApiWhatsappProvider implements WhatsappProviderAdapter {
  readonly providerName = 'evolution_api'

  constructor(
    private readonly baseUrl?: string,
    private readonly apiKey?: string,
    private readonly options: EvolutionApiProviderOptions = {},
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
      const response = await fetch(this.buildUrl('/instance/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey || '',
        },
        body: JSON.stringify(this.buildCreateInstancePayload(storeId, sessionName)),
      })

      if (!response.ok) {
        if (response.status === 403 && (await this.isInstanceAlreadyCreated(response))) {
          if (this.options.webhookUrl) {
            await this.setWebhook(sessionName)
          }

          const status = await this.getStatus(sessionName)
          return {
            sessionId: sessionName,
            status: status.status === 'connected' ? 'connected' : 'waiting_qr',
            message: 'Sessão Evolution API já existia; reutilizando instância local.',
          }
        }

        throw new Error(`Evolution API responded with status ${response.status}`)
      }

      const data = (await response.json()) as {
        instance?: { instanceName: string; status: string; state?: string }
        qrcode?: { code?: string; base64?: string }
      }
      const sessionStatus = data.instance?.status ?? data.instance?.state

      if (this.options.webhookUrl) {
        await this.setWebhook(sessionName)
      }

      return {
        sessionId: data.instance?.instanceName || sessionName,
        status: sessionStatus === 'open' || sessionStatus === 'connected' ? 'connected' : 'waiting_qr',
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
      const response = await fetch(this.buildUrl(`/instance/connect/${sessionId}`), {
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
        qrcode?: {
          code?: string
          base64?: string
        }
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
        qrCode: data.base64 || data.qrcode?.base64 || data.code || data.qrcode?.code || null,
        expiresAt: new Date(Date.now() + 40 * 1000).toISOString(), // Evolution API default expiration is usually ~40s
        status: data.code || data.base64 || data.qrcode?.code || data.qrcode?.base64 ? 'waiting_qr' : 'error',
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
      const response = await fetch(this.buildUrl(`/instance/connectionState/${sessionId}`), {
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
      const response = await fetch(this.buildUrl(`/instance/logout/${sessionId}`), {
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
    const response = await fetch(this.buildUrl(`/instance/restart/${sessionId}`), {
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
      const response = await fetch(this.buildUrl(`/message/sendText/${sessionId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey || '',
        },
        body: JSON.stringify({
          number: normalizedTo,
          text: message,
          delay: 1200,
          linkPreview: false,
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
      instanceName?: string
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
          imageMessage?: { caption?: string }
          videoMessage?: { caption?: string }
        }
        messageType?: string
        body?: string
        text?: string
        messageTimestamp?: number
      }
    }

    const event = body.event || 'unknown'
    const sessionId = body.instance || body.instanceName
    const fromMe = body.data?.key?.fromMe
    const pushName = body.data?.pushName

    const rawJid = body.data?.key?.remoteJid || ''
    const number = rawJid.split('@')[0] || ''

    let text = ''
    if (body.data?.body) {
      text = body.data.body
    } else if (body.data?.text) {
      text = body.data.text
    } else if (body.data?.message?.conversation) {
      text = body.data.message.conversation
    } else if (body.data?.message?.extendedTextMessage?.text) {
      text = body.data.message.extendedTextMessage.text
    } else if (body.data?.message?.imageMessage?.caption) {
      text = body.data.message.imageMessage.caption
    } else if (body.data?.message?.videoMessage?.caption) {
      text = body.data.message.videoMessage.caption
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

  private buildCreateInstancePayload(storeId: string, sessionName: string) {
    return {
      instanceName: sessionName,
      integration: this.options.integration ?? 'WHATSAPP-BAILEYS',
      token: storeId,
      qrcode: true,
      rejectCall: true,
      groupsIgnore: true,
      readMessages: true,
      readStatus: false,
      ...(this.options.webhookUrl
        ? {
            webhook: {
              url: this.options.webhookUrl,
              byEvents: false,
              base64: false,
              events: EVOLUTION_WEBHOOK_EVENTS,
            },
          }
        : {}),
    }
  }

  private async setWebhook(sessionName: string) {
    if (!this.options.webhookUrl) {
      return
    }

    const response = await fetch(this.buildUrl(`/webhook/set/${sessionName}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey || '',
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: this.options.webhookUrl,
          byEvents: false,
          webhookByEvents: false,
          base64: false,
          webhookBase64: false,
          events: EVOLUTION_WEBHOOK_EVENTS,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to configure Evolution API webhook: status ${response.status}`)
    }
  }

  private buildUrl(path: string) {
    return `${this.baseUrl?.replace(/\/+$/, '')}${path}`
  }

  private async isInstanceAlreadyCreated(response: Response) {
    try {
      const data = (await response.clone().json()) as {
        response?: {
          message?: string[]
        }
      }
      return data.response?.message?.some((message) => message.includes('already in use')) ?? false
    } catch {
      return false
    }
  }
}
