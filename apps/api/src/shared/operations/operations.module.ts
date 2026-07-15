import { Global, Module } from '@nestjs/common'

import { FeatureFlagsService } from './feature-flags.service'
import { ObservabilityService } from './observability.service'

@Global()
@Module({
  providers: [FeatureFlagsService, ObservabilityService],
  exports: [FeatureFlagsService, ObservabilityService],
})
export class OperationsModule {}
