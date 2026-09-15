import { parseAzureResponse, ClaudeReceiptSchema, claudeReceiptToScanResult } from '../src/lib/ocr'

const azureSuccess = {
  status: 'succeeded',
  analyzeResult: {
    documents: [{
      fields: {
        MerchantName: { valueString: 'The Burger Place' },
        Items: {
          valueArray: [
            {
              valueObject: {
                Description: { valueString: 'Classic Burger' },
                TotalPrice: { valueCurrency: { amount: 14.00 } },
              },
            },
            {
              valueObject: {
                Description: { valueString: 'Nachos' },
                TotalPrice: { valueCurrency: { amount: 12.00 } },
              },
            },
          ],
        },
        SubTotal: { valueCurrency: { amount: 26.00 } },
        TotalTax: { valueCurrency: { amount: 2.60 } },
        Tip: { valueCurrency: { amount: 5.20 } },
        Total: { valueCurrency: { amount: 33.80 } },
      },
    }],
  },
}

const azureNoTip = {
  status: 'succeeded',
  analyzeResult: {
    documents: [{
      fields: {
        Items: {
          valueArray: [
            { valueObject: { Description: { valueString: 'Burger' }, TotalPrice: { valueCurrency: { amount: 14 } } } },
          ],
        },
        SubTotal: { valueCurrency: { amount: 14 } },
        TotalTax: { valueCurrency: { amount: 1.4 } },
        Total: { valueCurrency: { amount: 15.4 } },
      },
    }],
  },
}

describe('parseAzureResponse', () => {
  it('extracts label, items, subtotal, tax, tip, and total', () => {
    const result = parseAzureResponse(azureSuccess)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('The Burger Place')
    expect(result!.items).toHaveLength(2)
    expect(result!.items[0]).toEqual({ name: 'Classic Burger', price: 14 })
    expect(result!.items[1]).toEqual({ name: 'Nachos', price: 12 })
    expect(result!.subtotal).toBe(26)
    expect(result!.tax).toBe(2.6)
    expect(result!.tip).toBe(5.2)
    expect(result!.total).toBe(33.8)
  })

  it('defaults tip to 0 when absent', () => {
    const result = parseAzureResponse(azureNoTip)
    expect(result).not.toBeNull()
    expect(result!.tip).toBe(0)
    expect(result!.label).toBeUndefined()
  })

  it('returns null when documents array is empty', () => {
    const result = parseAzureResponse({ status: 'succeeded', analyzeResult: { documents: [] } })
    expect(result).toBeNull()
  })
})

describe('ClaudeReceiptSchema', () => {
  it('accepts a null label', () => {
    const parsed = ClaudeReceiptSchema.safeParse({
      label: null, items: [{ name: 'Tacos', price: 12 }], subtotal: 12, tax: 1.2, tip: 0, total: 13.2,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects items without a numeric price', () => {
    const parsed = ClaudeReceiptSchema.safeParse({
      label: 'X', items: [{ name: 'Tacos', price: '12' }], subtotal: 12, tax: 0, tip: 0, total: 12,
    })
    expect(parsed.success).toBe(false)
  })
})

describe('claudeReceiptToScanResult', () => {
  it('maps a parsed receipt to a ScanResult', () => {
    const result = claudeReceiptToScanResult({
      label: 'Taco House', items: [{ name: 'Tacos', price: 12 }], subtotal: 12, tax: 1.2, tip: 0, total: 13.2,
    })
    expect(result).toEqual({
      label: 'Taco House', items: [{ name: 'Tacos', price: 12 }], subtotal: 12, tax: 1.2, tip: 0, total: 13.2,
    })
  })

  it('turns a null label into undefined', () => {
    const result = claudeReceiptToScanResult({
      label: null, items: [{ name: 'Tacos', price: 12 }], subtotal: 12, tax: 0, tip: 0, total: 12,
    })
    expect(result!.label).toBeUndefined()
  })

  it('returns null when there is no parsed output', () => {
    expect(claudeReceiptToScanResult(null)).toBeNull()
  })
})
