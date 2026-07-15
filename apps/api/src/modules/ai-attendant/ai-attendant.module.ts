import { Module } from '@nestjs/common'

import { CatalogModule } from '@/modules/catalog/catalog.module'

import { AiAttendantController } from './ai-attendant.controller'
import { AiAttendantService } from './ai-attendant.service'
import { AiPromptBuilderService } from './ai-prompt-builder.service'
import { AiOrderStatusService } from './ai-order-status.service'
import { AiProviderFactory } from './ai-provider.factory'
import { LovableSupabaseIntegrationService } from './lovable-supabase-integration.service'
import { WhatsappProviderFactory } from './whatsapp-provider.factory'
import { WebhookSecurityService } from './webhook-security.service'
import { WebhookReceiptService } from './webhook-receipt.service'

@Module({
  imports: [CatalogModule],
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
  ],
  exports: [AiAttendantService],
})
export class AiAttendantModule {}
