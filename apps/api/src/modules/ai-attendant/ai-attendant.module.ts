import { Module } from '@nestjs/common'

import { CatalogModule } from '@/modules/catalog/catalog.module'
import { CustomersModule } from '@/modules/customers/customers.module'
import { MessagingModule } from '@/modules/messaging/messaging.module'
import { OrdersModule } from '@/modules/orders/orders.module'
import { SecurityModule } from '@/shared/security/security.module'

import { AiAttendantController } from './ai-attendant.controller'
import { AiAttendantService } from './ai-attendant.service'
import { AiPromptBuilderService } from './ai-prompt-builder.service'
import { AiOrderStatusService } from './ai-order-status.service'
import { AiProviderFactory } from './ai-provider.factory'
import { LovableSupabaseIntegrationService } from './lovable-supabase-integration.service'
import { WhatsappProviderFactory } from './whatsapp-provider.factory'
import { WebhookSecurityService } from './webhook-security.service'
import { WebhookReceiptService } from './webhook-receipt.service'
import { NvidiaAiGateway } from './providers/nvidia/nvidia-ai.gateway'
import { CloudAiConversationProcessor } from './cloud-ai-conversation.processor'
import { AiConversationRepository } from './tools/ai-conversation.repository'
import { AiToolRegistry } from './tools/ai-tool.registry'
import { AiToolService } from './tools/ai-tool.service'

@Module({
  imports: [CatalogModule, CustomersModule, OrdersModule, MessagingModule, SecurityModule],
  controllers: [AiAttendantController],
  providers: [
    AiAttendantService,
    AiPromptBuilderService,
    AiOrderStatusService,
    WhatsappProviderFactory,
    AiProviderFactory,
    LovableSupabaseIntegrationService,
    WebhookSecurityService,
    WebhookReceiptService,
    NvidiaAiGateway,
    AiConversationRepository,
    AiToolService,
    AiToolRegistry,
    CloudAiConversationProcessor,
  ],
  exports: [AiAttendantService],
})
export class AiAttendantModule {}
