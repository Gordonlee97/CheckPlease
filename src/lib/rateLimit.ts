import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Scans are the only paid API calls. 10/hour per IP covers retakes at a table
// while capping what a single abuser can spend.
const SCANS_PER_WINDOW = 10
const WINDOW = '1 h'

interface Limiter {
  limit: (identifier: string) => Promise<{ success: boolean; reset: number }>
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

// Returns null when Upstash isn't configured (e.g. local dev) so scanning still works.
export function createScanLimiter(): Limiter | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — /api/scan is not rate limited')
    return null
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(SCANS_PER_WINDOW, WINDOW),
    prefix: 'checkplease:scan',
  })
}

// Vercel sets x-forwarded-for to the real client IP, overwriting any client-supplied value.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || 'unknown'
}

export async function checkRateLimit(limiter: Limiter | null, identifier: string): Promise<RateLimitResult> {
  if (!limiter) return { allowed: true }
  const { success, reset } = await limiter.limit(identifier)
  if (success) return { allowed: true }
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
}
