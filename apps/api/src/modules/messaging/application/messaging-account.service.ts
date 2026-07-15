import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { MessagingAccount } from '@prisma/client'

import { PrismaService } from '@/shared/prisma/prisma.service'

import { WhatsappCloudConfig } from '../infrastructure/whatsapp-cloud/whatsapp-cloud.config'

@Injectable()
export class MessagingAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudConfig: WhatsappCloudConfig,
  ) {}

  async resolveCloudAccount(input: {
    phoneNumberId: string
    businessAccountId: string
  }): Promise<MessagingAccount> {
    if (
      input.phoneNumberId !== this.cloudConfig.phoneNumberId ||
      input.businessAccountId !== this.cloudConfig.businessAccountId
    ) {
      throw new ForbiddenException('Webhook recebido para uma conta WhatsApp desconhecida.')
    }

    const store = await this.prisma.store.findUnique({ where: { id: this.cloudConfig.storeId } })
    if (!store) {
      throw new ServiceUnavailableException('WHATSAPP_STORE_ID nao corresponde a uma loja valida.')
    }

    const existing = await this.prisma.messagingAccount.findUnique({
      where: {
        provider_phoneNumberId: {
          provider: 'whatsapp_cloud',
          phoneNumberId: input.phoneNumberId,
        },
      },
    })
    if (existing) {
      if (existing.storeId !== store.id || !existing.enabled) {
        throw new ForbiddenException('Conta WhatsApp desabilitada ou vinculada a outra loja.')
      }
      return existing
    }

    const compatibilitySession =
      (await this.prisma.whatsappSession.findFirst({
        where: { storeId: store.id, provider: 'whatsapp_cloud' },
      })) ??
      (await this.prisma.whatsappSession.create({
        data: {
          storeId: store.id,
          provider: 'whatsapp_cloud',
          sessionName: `cloud:${input.phoneNumberId}`,
          status: 'connected',
          isEnabled: true,
          lastConnectedAt: new Date(),
        },
      }))

    return this.prisma.messagingAccount.upsert({
      where: {
        storeId_provider: {
          storeId: store.id,
          provider: 'whatsapp_cloud',
        },
      },
      create: {
        storeId: store.id,
        provider: 'whatsapp_cloud',
        externalAccountId: input.businessAccountId,
        phoneNumberId: input.phoneNumberId,
        legacySessionId: compatibilitySession.id,
      },
      update: {
        externalAccountId: input.businessAccountId,
        phoneNumberId: input.phoneNumberId,
        legacySessionId: compatibilitySession.id,
        enabled: true,
      },
    })
  }

  async getEnabledForStore(storeId: string) {
    return this.prisma.messagingAccount.findFirst({
      where: { storeId, enabled: true },
      orderBy: { createdAt: 'desc' },
    })
  }
}
