import { z } from 'zod'
import { normalizeCurrency } from './money'
import type { ScanResult } from './types'

// Only the Azure prebuilt-receipt fields this app reads.
interface AzureCurrencyField { valueCurrency?: { amount?: number; currencyCode?: string }; confidence?: number }
interface AzureItemEntry {
  valueObject?: {
    Description?: { valueString?: string }
    TotalPrice?: AzureCurrencyField
  }
}
interface AzureReceiptFields {
  MerchantName?: { valueString?: string }
  Items?: { valueArray?: AzureItemEntry[] }
  SubTotal?: AzureCurrencyField
  TotalTax?: AzureCurrencyField
  Tip?: AzureCurrencyField
  Total?: AzureCurrencyField
}
export interface AzureAnalyzeResponse {
  status?: string // 'succeeded' | 'failed' | 'running', polled by /api/scan
  analyzeResult?: { documents?: Array<{ fields?: AzureReceiptFields }> }
}

export function parseAzureResponse(azureResult: AzureAnalyzeResponse): ScanResult | null {
  const doc = azureResult?.analyzeResult?.documents?.[0]
  if (!doc) return null

  const fields: AzureReceiptFields = doc.fields ?? {}
  const itemsArray = (fields.Items?.valueArray ?? []).map(entry => ({
    name: entry.valueObject?.Description?.valueString ?? 'Unknown item',
    price: entry.valueObject?.TotalPrice?.valueCurrency?.amount ?? 0,
    confidence: entry.valueObject?.TotalPrice?.confidence as number | undefined,
  }))

  // Azure tags each amount with a currency; the total is the most reliable one
  const currency = normalizeCurrency(
    fields.Total?.valueCurrency?.currencyCode ?? fields.SubTotal?.valueCurrency?.currencyCode,
  )

  return {
    label: fields.MerchantName?.valueString,
    currency,
    items: itemsArray,
    subtotal: fields.SubTotal?.valueCurrency?.amount ?? 0,
    tax: fields.TotalTax?.valueCurrency?.amount ?? 0,
    tip: fields.Tip?.valueCurrency?.amount ?? 0,
    total: fields.Total?.valueCurrency?.amount ?? 0,
  }
}

// Structured-output schema for the Claude fallback. The API constrains the
// response to this shape, so no JSON extraction from free text is needed.
export const ClaudeReceiptSchema = z.object({
  label: z.string().nullable().describe('Restaurant name, or null if not shown'),
  currency: z.string().nullable().describe('ISO 4217 code for the amounts, e.g. USD or EUR; null if the receipt does not say'),
  items: z.array(z.object({
    name: z.string().describe('Item description as printed'),
    price: z.number().describe('Full line total: quantity × unit price'),
  })),
  subtotal: z.number(),
  tax: z.number(),
  tip: z.number().describe('0 if no tip is printed'),
  total: z.number(),
})

export type ClaudeReceipt = z.infer<typeof ClaudeReceiptSchema>

// Azure reports per-item confidence; below this the price is worth a second look.
export const LOW_CONFIDENCE = 0.8

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Azure is the primary reader but sometimes misreads an amount. When it flags
// low confidence, Claude re-reads the same photo and its price wins for those
// items only — everything Azure was sure about is left untouched.
export function reconcileLowConfidence(azure: ScanResult, claude: ScanResult): ScanResult {
  const byName = new Map(claude.items.map(item => [normalizeName(item.name), item]))

  const items = azure.items.map(item => {
    if (item.confidence === undefined || item.confidence >= LOW_CONFIDENCE) return item

    const match = byName.get(normalizeName(item.name))
    if (!match) return item // nothing to compare against; leave the warning up

    // Agreement from two readers is as good as a confident read
    if (Math.abs(match.price - item.price) < 0.01) {
      return { ...item, price: item.price, confidence: undefined }
    }
    // They disagree: trust Claude's price, but keep the warning so it gets checked
    return { ...item, price: match.price }
  })

  return { ...azure, items, label: azure.label ?? claude.label, currency: azure.currency ?? claude.currency }
}

export function hasLowConfidenceItem(result: ScanResult): boolean {
  return result.items.some(i => i.confidence !== undefined && i.confidence < LOW_CONFIDENCE)
}

export function claudeReceiptToScanResult(receipt: ClaudeReceipt | null): ScanResult | null {
  if (!receipt) return null
  return {
    ...receipt,
    label: receipt.label ?? undefined,
    currency: normalizeCurrency(receipt.currency),
  }
}
