import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type OperationalFeature =
  | 'whatsapp'
  | 'aiAttendant'
  | 'printing'
  | 'waiterPwa'
  | 'publicTracking'
  | 'orderNotifications'

const featureEnvironmentKeys: Record<OperationalFeature, string> = {
  whatsapp: 'FEATURE_WHATSAPP_ENABLED',
  aiAttendant: 'FEATURE_AI_ATTENDANT_ENABLED',
  printing: 'FEATURE_PRINTING_ENABLED',
  waiterPwa: 'FEATURE_WAITER_PWA_ENABLED',
  publicTracking: 'FEATURE_PUBLIC_TRACKING_ENABLED',
  orderNotifications: 'FEATURE_ORDER_NOTIFICATIONS_ENABLED',
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly config: ConfigService) {}

  isEnabled(feature: OperationalFeature) {
    const configured = this.config.get<boolean | string>(featureEnvironmentKeys[feature])
    if (typeof configured === 'boolean') return configured
    if (configured === 'true') return true
    if (configured === 'false') return false

    const appEnvironment =
      this.config.get<string>('APP_ENV') ?? this.config.get<string>('NODE_ENV') ?? 'development'
    return appEnvironment === 'development' || appEnvironment === 'test'
  }

  snapshot() {
    return Object.fromEntries(
      (Object.keys(featureEnvironmentKeys) as OperationalFeature[]).map((feature) => [
        feature,
        this.isEnabled(feature),
      ]),
    ) as Record<OperationalFeature, boolean>
  }
}
