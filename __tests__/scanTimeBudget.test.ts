/**
 * The scan route runs under Vercel's maxDuration (60s). Azure polling alone
 * could sleep ~33s, then the Claude call ran with the SDK's 10-minute timeout
 * and two retries, so a slow scan was killed mid-request with a bare 504.
 * Time is simulated: each sleep advances a fake clock instead of waiting.
 */
const parse = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk')
  class MockAnthropic {
    beta = { messages: { parse } }
  }
  for (const key of Object.getOwnPropertyNames(actual.default)) {
    if (['length', 'name', 'prototype'].includes(key)) continue
    Object.defineProperty(MockAnthropic, key, Object.getOwnPropertyDescriptor(actual.default, key)!)
  }
  return { ...actual, __esModule: true, default: MockAnthropic }
})

jest.mock('@/lib/rateLimit', () => ({
  ...jest.requireActual('@/lib/rateLimit'),
  createScanLimiter: () => null,
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
}))

import { POST, maxDuration } from '../src/app/api/scan/route'

let now = 0
const originalEnv = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  now = 1_000_000
  process.env = { ...originalEnv, AZURE_DI_ENDPOINT: 'https://example.cognitiveservices.azure.com', AZURE_DI_KEY: 'key' }
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
    now += ms ?? 0
    fn()
    return 0
  }) as unknown as typeof setTimeout)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env = originalEnv
  jest.restoreAllMocks()
})

function scanRequest() {
  const form = new FormData()
  form.append('image', 'BASE64')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Request('https://checkplease.space/api/scan', { method: 'POST', body: form }) as any
}

const claudeReceipt = {
  stop_reason: 'end_turn',
  parsed_output: { label: 'Claude Diner', items: [{ name: 'A', price: 5 }, { name: 'B', price: 6 }], subtotal: 11, tax: 0, tip: 0, total: 11 },
}

// Azure accepts the job, then reports "running" on every poll; each poll
// takes 500ms of (simulated) network time.
function azureNeverFinishes() {
  let polls = 0
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes(':analyze')) {
      return { ok: true, headers: new Headers({ 'Operation-Location': 'https://example/op/1' }) }
    }
    polls++
    now += 500
    return { ok: true, json: async () => ({ status: 'running' }) }
  }) as unknown as typeof fetch
  return () => polls
}

describe('POST /api/scan time budget', () => {
  it('stops waiting on Azure in time to ask Claude, and caps Claude at the time left', async () => {
    const start = now
    azureNeverFinishes()
    parse.mockImplementation(async () => claudeReceipt)

    const res = await POST(scanRequest())

    expect(res.status).toBe(200)
    expect(parse).toHaveBeenCalledTimes(1)
    const [, options] = parse.mock.calls[0]
    expect(options.maxRetries).toBe(0)
    // Claude's timeout must end before the function is killed
    expect(Date.now() - start + options.timeout).toBeLessThan(maxDuration * 1000)
    expect(options.timeout).toBeGreaterThanOrEqual(15_000)
  })

  it('skips the low-confidence recheck when there is no time left for it', async () => {
    // Azure only finishes, with a shaky price, ~47s in
    let polls = 0
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes(':analyze')) {
        return { ok: true, headers: new Headers({ 'Operation-Location': 'https://example/op/1' }) }
      }
      polls++
      // The third poll starts well inside Azure's share of the time but answers slowly
      now += polls < 3 ? 500 : 45_000
      const done = polls >= 3
      return {
        ok: true,
        json: async () => done
          ? { status: 'succeeded', analyzeResult: { documents: [{ fields: {
              Items: { valueArray: [
                { valueObject: { Description: { valueString: 'Tacos' }, TotalPrice: { valueCurrency: { amount: 12 }, confidence: 0.99 } } },
                { valueObject: { Description: { valueString: 'Beer' }, TotalPrice: { valueCurrency: { amount: 2 }, confidence: 0.3 } } },
              ] },
              Total: { valueCurrency: { amount: 14 } },
            } }] } }
          : { status: 'running' },
      }
    }) as unknown as typeof fetch

    const res = await POST(scanRequest())

    expect(res.status).toBe(200)
    expect(parse).not.toHaveBeenCalled()
    expect((await res.json()).items.map((i: { name: string }) => i.name)).toEqual(['Tacos', 'Beer'])
  })
})
