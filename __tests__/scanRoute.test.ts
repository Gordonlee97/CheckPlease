/**
 * Route-level tests for POST /api/scan. Azure is stubbed through global.fetch
 * and Claude through the SDK's parse(); no network, no API keys.
 */
const parse = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk')
  class MockAnthropic {
    beta = { messages: { parse } }
  }
  // Carry over the real statics (APIError and friends) — they're non-enumerable,
  // so Object.assign misses them, and scanErrors relies on `instanceof APIError`
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

import { APIError } from '@anthropic-ai/sdk'
import { POST } from '../src/app/api/scan/route'
import { checkRateLimit } from '@/lib/rateLimit'

const AZURE_ENV = { AZURE_DI_ENDPOINT: 'https://example.cognitiveservices.azure.com', AZURE_DI_KEY: 'key' }

function azureDoc(items: Array<[string, number]>) {
  return {
    status: 'succeeded',
    analyzeResult: {
      documents: [{
        fields: {
          MerchantName: { valueString: 'Azure Diner' },
          Items: { valueArray: items.map(([name, price]) => ({ valueObject: { Description: { valueString: name }, TotalPrice: { valueCurrency: { amount: price } } } })) },
          SubTotal: { valueCurrency: { amount: 30 } },
          TotalTax: { valueCurrency: { amount: 3 } },
          Total: { valueCurrency: { amount: 33 } },
        },
      }],
    },
  }
}

// submit → 202 with Operation-Location, then one poll returning `poll`
function azureFetch(poll: object) {
  return jest.fn()
    .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'Operation-Location': 'https://example/op/1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => poll })
}

function claudeResult(label: string) {
  return {
    stop_reason: 'end_turn',
    parsed_output: { label, items: [{ name: 'Claude item', price: 9 }], subtotal: 9, tax: 1, tip: 0, total: 10 },
  }
}

function scanRequest(body?: FormData, origin = 'http://localhost:3000') {
  const form = body ?? new FormData()
  if (!body) form.append('image', 'BASE64')
  return new Request('https://checkplease.vercel.app/api/scan', { method: 'POST', body: form, headers: { origin } })
}

const originalEnv = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...originalEnv, ...AZURE_ENV }
  ;(checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env = originalEnv
  jest.restoreAllMocks()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const post = (req: Request) => POST(req as any)

describe('POST /api/scan', () => {
  it('returns Azure results without calling Claude', async () => {
    global.fetch = azureFetch(azureDoc([['Tacos', 12], ['Burrito', 18]])) as unknown as typeof fetch

    const res = await post(scanRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.label).toBe('Azure Diner')
    expect(body.items.map((i: { name: string }) => i.name)).toEqual(['Tacos', 'Burrito'])
    expect(parse).not.toHaveBeenCalled()
  })

  it('falls back to Claude when Azure finds fewer than two items', async () => {
    global.fetch = azureFetch(azureDoc([['Lonely item', 12]])) as unknown as typeof fetch
    parse.mockResolvedValue(claudeResult('Claude Diner'))

    const body = await (await post(scanRequest())).json()

    expect(parse).toHaveBeenCalledTimes(1)
    expect(body.label).toBe('Claude Diner')
  })

  // Regression: a throwing Azure call used to end the request before Claude ran
  it('falls back to Claude when Azure throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    parse.mockResolvedValue(claudeResult('Claude Diner'))

    const res = await post(scanRequest())

    expect(res.status).toBe(200)
    expect((await res.json()).label).toBe('Claude Diner')
  })

  it('goes straight to Claude when Azure is not configured', async () => {
    // env.d.ts types these as required strings, though the route treats them as optional
    const env = process.env as Record<string, string | undefined>
    delete env.AZURE_DI_ENDPOINT
    delete env.AZURE_DI_KEY
    global.fetch = jest.fn() as unknown as typeof fetch
    parse.mockResolvedValue(claudeResult('Claude Diner'))

    expect((await post(scanRequest())).status).toBe(200)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 422 when Claude refuses', async () => {
    global.fetch = azureFetch(azureDoc([])) as unknown as typeof fetch
    parse.mockResolvedValue({ stop_reason: 'refusal', parsed_output: null })

    const res = await post(scanRequest())

    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/could not read/i)
  })

  it('explains a spend-limit failure instead of a generic 500', async () => {
    global.fetch = azureFetch(azureDoc([])) as unknown as typeof fetch
    parse.mockRejectedValue(APIError.generate(
      429,
      { type: 'error', error: { type: 'rate_limit_error', message: 'cap', details: { error_code: 'enforced_spend_limit_reached' } } },
      'cap',
      new Headers(),
    ))

    const res = await post(scanRequest())

    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/manually/i)
  })

  it('rejects a request with no image', async () => {
    const res = await post(scanRequest(new FormData()))
    expect(res.status).toBe(400)
  })

  it('passes the rate limiter refusal through with Retry-After', async () => {
    ;(checkRateLimit as jest.Mock).mockResolvedValue({ allowed: false, retryAfterSeconds: 120 })

    const res = await post(scanRequest())

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect((await res.json()).error).toMatch(/2 minutes/)
  })

  it('echoes an allowed origin and withholds others', async () => {
    global.fetch = azureFetch(azureDoc([['Tacos', 12], ['Burrito', 18]])) as unknown as typeof fetch
    const allowed = await post(scanRequest(undefined, 'http://localhost:3000'))
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')

    global.fetch = azureFetch(azureDoc([['Tacos', 12], ['Burrito', 18]])) as unknown as typeof fetch
    const blocked = await post(scanRequest(undefined, 'https://evil.example'))
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBe('')
  })
})
