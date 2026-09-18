import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { parseAzureResponse, ClaudeReceiptSchema, claudeReceiptToScanResult, hasLowConfidenceItem, reconcileLowConfidence } from '@/lib/ocr'
import { createScanLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit'
import { describeScanFailure } from '@/lib/scanErrors'
import type { ScanResult } from '@/lib/types'

export const maxDuration = 60

const AZURE_API_VERSION = '2024-11-30'
const AZURE_MODEL = 'prebuilt-receipt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const scanLimiter = createScanLimiter()

const ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:3000',
  'https://checkplease.vercel.app',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

async function analyzeWithAzure(base64Image: string): Promise<ScanResult | null> {
  const endpoint = process.env.AZURE_DI_ENDPOINT?.replace(/\/$/, '')
  const key = process.env.AZURE_DI_KEY
  if (!endpoint || !key) return null

  const submitRes = await fetch(
    `${endpoint}/documentintelligence/documentModels/${AZURE_MODEL}:analyze?api-version=${AZURE_API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Source: base64Image }),
    }
  )

  if (!submitRes.ok) return null
  const operationUrl = submitRes.headers.get('Operation-Location')
  if (!operationUrl) return null

  // Poll until succeeded (exponential backoff, ~20 iterations)
  for (let i = 0; i < 20; i++) {
    const delay = Math.min(300 * Math.pow(1.4, i), 2000)
    await new Promise(r => setTimeout(r, delay))
    const pollRes = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })
    if (!pollRes.ok) return null
    const data = await pollRes.json()
    if (data.status === 'succeeded') return parseAzureResponse(data)
    if (data.status === 'failed') return null
  }
  return null
}

async function analyzeWithClaude(base64Image: string): Promise<ScanResult | null> {
  const message = await anthropic.beta.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    // Simple extraction; low effort keeps the scan fast while the user waits at the table.
    output_config: { effort: 'low', format: betaZodOutputFormat(ClaudeReceiptSchema) },
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
        },
        {
          type: 'text',
          text: 'Extract every line item from this receipt, along with the restaurant name, subtotal, tax, tip, and total. Each item price is the full line total, with quantity already multiplied in.',
        },
      ],
    }],
  })
  if (message.stop_reason === 'refusal') return null
  return claudeReceiptToScanResult(message.parsed_output)
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  try {
    const rate = await checkRateLimit(scanLimiter, getClientIp(req.headers))
    if (!rate.allowed) {
      const minutes = Math.ceil(rate.retryAfterSeconds / 60)
      return NextResponse.json(
        { error: `Too many scans. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` },
        { status: 429, headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const formData = await req.formData()
    const base64Image = formData.get('image') as string | null
    if (!base64Image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400, headers })
    }

    // Azure problems must never end the request — Claude is the fallback.
    // A Claude failure does propagate, so the catch below can explain it.
    let result: ScanResult | null = null
    try {
      result = await analyzeWithAzure(base64Image)
    } catch (err) {
      console.error('[scan] azure failed, falling back to Claude:', err)
    }
    if (!result || result.items.length < 2) {
      result = await analyzeWithClaude(base64Image)
    } else if (hasLowConfidenceItem(result)) {
      // Azure misread at least one amount. Have Claude re-read the same photo
      // and take its price for those items only. A failure here is not fatal:
      // Azure's result still stands, with its warnings intact.
      try {
        const second = await analyzeWithClaude(base64Image)
        if (second) result = reconcileLowConfidence(result, second)
      } catch (err) {
        console.error('[scan] low-confidence recheck failed, keeping Azure result:', err)
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'Could not read receipt' }, { status: 422, headers })
    }

    return NextResponse.json(result, { headers })
  } catch (err) {
    // Logged in full for Vercel; the client gets something a diner can act on
    console.error('[scan] failed:', err)
    const failure = describeScanFailure(err)
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers })
  }
}
