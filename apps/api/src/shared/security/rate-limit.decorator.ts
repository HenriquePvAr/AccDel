import { SetMetadata } from '@nestjs/common'

export const RATE_LIMIT_KEY = 'security:rate-limit'

export interface RateLimitOptions {
  limit: number
  windowMs: number
  scopes?: Array<'ip' | 'user' | 'store'>
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options)
