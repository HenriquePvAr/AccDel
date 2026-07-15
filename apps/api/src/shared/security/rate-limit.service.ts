import { Injectable } from '@nestjs/common'

interface RateLimitBucket {
  count: number
  resetAt: number
}

export interface RateLimitDecision {
  allowed: boolean
  retryAfterSeconds: number
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>()
  private operations = 0

  consume(keys: string[], limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    const uniqueKeys = Array.from(new Set(keys))
    const retryAfter = uniqueKeys.reduce((longest, key) => {
      const current = this.buckets.get(key)
      if (!current || current.resetAt <= now || current.count < limit) {
        return longest
      }

      return Math.max(longest, current.resetAt - now)
    }, 0)

    if (retryAfter > 0) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfter / 1000)),
      }
    }

    for (const key of uniqueKeys) {
      const current = this.buckets.get(key)
      if (!current || current.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      } else {
        current.count += 1
      }
    }

    this.operations += 1
    if (this.operations % 250 === 0) {
      this.prune(now)
    }

    return { allowed: true, retryAfterSeconds: 0 }
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key)
      }
    }
  }
}
