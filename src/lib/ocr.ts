import { z } from 'zod'
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

// Structured-output schema for the Claude fallback. The API constrains the
// response to this shape, so no JSON extraction from free text is needed.
export const ClaudeReceiptSchema = z.object({
  label: z.string().nullable().describe('Restaurant name, or null if not shown'),
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

export function claudeReceiptToScanResult(receipt: ClaudeReceipt | null): ScanResult | null {
  if (!receipt) return null
  return { ...receipt, label: receipt.label ?? undefined }
}
