import { getClientIp, checkRateLimit } from '../src/lib/rateLimit'

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
