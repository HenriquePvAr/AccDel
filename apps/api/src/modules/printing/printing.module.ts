import { Module } from '@nestjs/common'

import { PrintAgentAuthGuard } from './print-agent-auth.guard'
import { PrintAgentController } from './print-agent.controller'
import { PrintAgentService } from './print-agent.service'
import { PrintingAdminController } from './printing-admin.controller'
import { PrintingAdminService } from './printing-admin.service'
import { PrintingPolicyService } from './printing-policy.service'

@Module({
  controllers: [PrintingAdminController, PrintAgentController],
  providers: [
    PrintingAdminService,
    PrintingPolicyService,
    PrintAgentService,
    PrintAgentAuthGuard,
  ],
  exports: [PrintingPolicyService],
})
export class PrintingModule {}
