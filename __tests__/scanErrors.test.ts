import { APIError } from '@anthropic-ai/sdk'
import { describeScanFailure } from '../src/lib/scanErrors'

function apiError(status: number, body: object, message: string) {
  return APIError.generate(status, body, message, new Headers())
}

describe('describeScanFailure', () => {
  it('reports the org spend cap as temporarily unavailable', () => {
    const err = apiError(429, {
      type: 'error',
      error: { type: 'rate_limit_error', message: 'crossed its monthly API usage threshold', details: { error_code: 'enforced_spend_limit_reached' } },
    }, 'monthly API usage threshold')

    const failure = describeScanFailure(err)
    expect(failure.status).toBe(503)
    expect(failure.error).toMatch(/unavailable/i)
    expect(failure.error).toMatch(/manually/i) // point them at the workaround that still works
  })

  it('reports a self-set spend limit the same way', () => {
    const err = apiError(400, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'You have reached your specified API usage limits.' },
    }, 'You have reached your specified API usage limits.')

    expect(describeScanFailure(err).status).toBe(503)
    expect(describeScanFailure(err).error).toMatch(/unavailable/i)
  })

  it('reports upstream rate limiting as busy, not broken', () => {
    const err = apiError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'rate limit' } }, 'rate limit')
    const failure = describeScanFailure(err)
    expect(failure.status).toBe(503)
    expect(failure.error).toMatch(/busy|moment/i)
  })

  it('hides credential problems behind the unavailable message', () => {
    const err = apiError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key')
    const failure = describeScanFailure(err)
    expect(failure.status).toBe(503)
    expect(failure.error).not.toMatch(/api.?key/i)
  })

  it('treats an upstream outage as temporary', () => {
    const err = apiError(529, { type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } }, 'overloaded')
    expect(describeScanFailure(err).status).toBe(503)
  })

  it('falls back to a generic 500 for anything else', () => {
    expect(describeScanFailure(new TypeError('boom'))).toEqual({ status: 500, error: 'Internal server error' })
  })
})
