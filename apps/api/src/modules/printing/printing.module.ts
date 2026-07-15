import { Module } from '@nestjs/common'

import { PrintingAdminController } from './printing-admin.controller'
import { PrintingAdminService } from './printing-admin.service'
import { PrintingPolicyService } from './printing-policy.service'

@Module({
  controllers: [PrintingAdminController],
  providers: [PrintingAdminService, PrintingPolicyService],
  exports: [PrintingPolicyService],
})
export class PrintingModule {}
