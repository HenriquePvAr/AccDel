import { Module } from '@nestjs/common'

import { TrackingModule } from '@/modules/tracking/tracking.module'

import { ConversationWindowService } from './application/conversation-window.service'
import { InboundEventIngressService } from './application/inbound-event-ingress.service'
import { MessagingAccountService } from './application/messaging-account.service'
import { MessagingOutboxService } from './application/messaging-outbox.service'
import { MessagingSandboxPolicy } from './application/messaging-sandbox-policy.service'
import { MessagingProviderRouter } from './application/messaging-provider-router.service'
import { OutboundStatusService } from './application/outbound-status.service'
import { OutboxProcessorService } from './application/outbox-processor.service'
import { OrderNotificationProcessorService } from './application/order-notification-processor.service'
import { MessagingRetentionService } from './application/messaging-retention.service'
import { WhatsappCloudWebhookController } from './controllers/whatsapp-cloud-webhook.controller'
import { EvolutionLegacyMessagingProvider } from './infrastructure/evolution/evolution-legacy-messaging.provider'
import { WhatsappCloudConfig } from './infrastructure/whatsapp-cloud/whatsapp-cloud.config'
import { WhatsappCloudProvider } from './infrastructure/whatsapp-cloud/whatsapp-cloud.provider'
import { WhatsappCloudWebhookSecurityService } from './infrastructure/whatsapp-cloud/whatsapp-cloud-webhook-security.service'

@Module({
  imports: [TrackingModule],
  controllers: [WhatsappCloudWebhookController],
  providers: [
    WhatsappCloudConfig,
    WhatsappCloudWebhookSecurityService,
    WhatsappCloudProvider,
    EvolutionLegacyMessagingProvider,
    MessagingProviderRouter,
    MessagingAccountService,
    ConversationWindowService,
    MessagingOutboxService,
    MessagingSandboxPolicy,
    OutboundStatusService,
    InboundEventIngressService,
    OutboxProcessorService,
    OrderNotificationProcessorService,
    MessagingRetentionService,
  ],
  exports: [
    MessagingAccountService,
    ConversationWindowService,
    MessagingOutboxService,
    OutboundStatusService,
  ],
})
export class MessagingModule {}
