import { SetMetadata } from '@nestjs/common'

export const IDEMPOTENCY_KEY = 'security:idempotency'

export interface IdempotencyOptions {
  operation: string
  required?: boolean
  ttlMs?: number
}

export const Idempotent = (options: IdempotencyOptions) =>
  SetMetadata(IDEMPOTENCY_KEY, options)
