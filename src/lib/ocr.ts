import type { ScanResult } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAzureResponse(azureResult: any): ScanResult | null {
  const doc = azureResult?.analyzeResult?.documents?.[0]
  if (!doc) return null

  const fields = doc.fields ?? {}
  const itemsArray = (fields.Items?.valueArray ?? []).map((entry: any) => ({
    name: entry.valueObject?.Description?.valueString ?? 'Unknown item',
    price: entry.valueObject?.TotalPrice?.valueCurrency?.amount ?? 0,
    confidence: entry.valueObject?.TotalPrice?.confidence as number | undefined,
  }))

  return {
    label: fields.MerchantName?.valueString,
    items: itemsArray,
    subtotal: fields.SubTotal?.valueCurrency?.amount ?? 0,
    tax: fields.TotalTax?.valueCurrency?.amount ?? 0,
    tip: fields.Tip?.valueCurrency?.amount ?? 0,
    total: fields.Total?.valueCurrency?.amount ?? 0,
  }
}

export function parseClaudeResponse(text: string): ScanResult | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.items)) return null
    return parsed as ScanResult
  } catch {
    return null
  }
}
