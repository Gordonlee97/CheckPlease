import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseAzureResponse, parseClaudeResponse } from '@/lib/ocr'
import type { ScanResult } from '@/lib/types'

const AZURE_API_VERSION = '2024-11-30'
const AZURE_MODEL = 'prebuilt-receipt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  // Poll until succeeded (max 8 seconds)
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500))
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
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
        },
        {
          type: 'text',
          text: `Extract all line items from this receipt. Return ONLY a JSON object with this structure, no other text:
{
  "label": "restaurant name or null",
  "items": [{"name": "item description", "price": 0.00}],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "total": 0.00
}
Each item's price should be the full line total (quantity × unit price already multiplied).`,
        },
      ],
    }],
  })
  const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
  return parseClaudeResponse(text)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const base64Image = formData.get('image') as string | null
    if (!base64Image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    let result = await analyzeWithAzure(base64Image)
    if (!result || result.items.length < 2) {
      result = await analyzeWithClaude(base64Image)
    }

    if (!result) {
      return NextResponse.json({ error: 'Could not read receipt' }, { status: 422 })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
