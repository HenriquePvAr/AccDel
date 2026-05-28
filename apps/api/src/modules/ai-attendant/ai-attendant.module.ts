import { Module } from '@nestjs/common'

import { AiAttendantController } from './ai-attendant.controller'
import { AiAttendantService } from './ai-attendant.service'
import { AiProviderFactory } from './ai-provider.factory'
import { WhatsappProviderFactory } from './whatsapp-provider.factory'

@Module({
  controllers: [AiAttendantController],
  providers: [AiAttendantService, WhatsappProviderFactory, AiProviderFactory],
  exports: [AiAttendantService],
})
export class AiAttendantModule {}
