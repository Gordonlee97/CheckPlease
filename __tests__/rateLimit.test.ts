import { getClientIp, checkRateLimit, createScanLimiter } from '../src/lib/rateLimit'

describe('createScanLimiter', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved } })

  function clearRedisEnv() {
    for (const key of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
      delete process.env[key]
    }
  }

  it('returns null when no Redis credentials are set', () => {
    clearRedisEnv()
    expect(createScanLimiter()).toBeNull()
  })

  it('builds a limiter from UPSTASH_REDIS_REST_* credentials', () => {
    clearRedisEnv()
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    expect(createScanLimiter()).not.toBeNull()
  })

  // Vercel's Upstash integration injects these names instead
  it('builds a limiter from KV_REST_API_* credentials', () => {
    clearRedisEnv()
    process.env.KV_REST_API_URL = 'https://example.upstash.io'
    process.env.KV_REST_API_TOKEN = 'token'
    expect(createScanLimiter()).not.toBeNull()
  })
})

describe('getClientIp', () => {
  it('uses the first address in x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    expect(getClientIp(headers)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.2' })
    expect(getClientIp(headers)).toBe('198.51.100.2')
  })

  it('returns "unknown" when no IP header is present', () => {
    expect(getClientIp(new Headers())).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  it('allows the request when no limiter is configured', async () => {
    expect(await checkRateLimit(null, '1.2.3.4')).toEqual({ allowed: true })
  })

  it('allows the request when under the limit', async () => {
    const limiter = { limit: jest.fn().mockResolvedValue({ success: true, reset: 0 }) }
    expect(await checkRateLimit(limiter, '1.2.3.4')).toEqual({ allowed: true })
    expect(limiter.limit).toHaveBeenCalledWith('1.2.3.4')
  })

  it('blocks with a whole-second retryAfter when over the limit', async () => {
    const now = 1_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const limiter = { limit: jest.fn().mockResolvedValue({ success: false, reset: now + 90_500 }) }
    expect(await checkRateLimit(limiter, '1.2.3.4')).toEqual({ allowed: false, retryAfterSeconds: 91 })
  })
})
