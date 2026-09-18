import Anthropic from '@anthropic-ai/sdk'
import type { APIError } from '@anthropic-ai/sdk'

export interface ScanFailure {
  status: number
  error: string
}

// Shown under "Could not read receipt" on the Scan step, so it has to be
// something a diner can act on — not an HTTP code.
const UNAVAILABLE = 'Receipt scanning is unavailable right now. Try again later, or enter the items manually.'
const BUSY = 'Receipt scanning is busy. Wait a moment and try again, or enter the items manually.'

interface AnthropicErrorBody {
  error?: { details?: { error_code?: string } }
}

// A spend cap stops scanning until the limit resets, so it reads as
// "unavailable" rather than "try again in a moment".
function isSpendLimit(err: APIError): boolean {
  const code = (err.error as AnthropicErrorBody | undefined)?.error?.details?.error_code
  if (code === 'enforced_spend_limit_reached') return true
  // A self-set limit returns 400 invalid_request_error with this wording
  return err.status === 400 && /usage limits/i.test(err.message)
}

export function describeScanFailure(err: unknown): ScanFailure {
  if (err instanceof Anthropic.APIError) {
    if (isSpendLimit(err)) return { status: 503, error: UNAVAILABLE }
    if (err.status === 429) return { status: 503, error: BUSY }
    // Bad or missing credentials are ours to fix; don't describe them to users
    if (err.status === 401 || err.status === 403) return { status: 503, error: UNAVAILABLE }
    if (err.status !== undefined && err.status >= 500) return { status: 503, error: BUSY }
  }
  return { status: 500, error: 'Internal server error' }
}
