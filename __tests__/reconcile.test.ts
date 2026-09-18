import { reconcileLowConfidence, LOW_CONFIDENCE } from '../src/lib/ocr'
import type { ScanResult } from '../src/lib/types'

const azure = (items: ScanResult['items']): ScanResult => ({
  label: 'Azure Diner', items, subtotal: 30, tax: 3, tip: 0, total: 33,
})
const claude = (items: ScanResult['items']): ScanResult => ({
  label: 'Claude Diner', items, subtotal: 31, tax: 3, tip: 0, total: 34,
})

describe('reconcileLowConfidence', () => {
  it('takes the Claude price for a shaky item and leaves confident ones alone', () => {
    const result = reconcileLowConfidence(
      azure([
        { name: 'Tacos', price: 12, confidence: 0.99 },
        { name: 'Burrito', price: 2, confidence: 0.4 },
      ]),
      claude([
        { name: 'Tacos', price: 12 },
        { name: 'Burrito', price: 20 },
      ]),
    )

    expect(result.items[0].price).toBe(12)
    expect(result.items[1].price).toBe(20)
  })

  it('keeps the warning when the two sources disagree', () => {
    const result = reconcileLowConfidence(
      azure([{ name: 'Burrito', price: 2, confidence: 0.4 }]),
      claude([{ name: 'Burrito', price: 20 }]),
    )
    expect(result.items[0].confidence).toBeLessThan(LOW_CONFIDENCE)
  })

  it('clears the warning when both sources agree on the price', () => {
    const result = reconcileLowConfidence(
      azure([{ name: 'Burrito', price: 20, confidence: 0.4 }]),
      claude([{ name: 'Burrito', price: 20 }]),
    )
    expect(result.items[0].confidence).toBeUndefined()
  })

  it('matches item names loosely', () => {
    const result = reconcileLowConfidence(
      azure([{ name: 'YELLOWTAIL ROLL ', price: 5, confidence: 0.3 }]),
      claude([{ name: 'Yellowtail Roll', price: 15.5 }]),
    )
    expect(result.items[0].price).toBe(15.5)
  })

  it('keeps the Azure item when Claude has no match for it', () => {
    const result = reconcileLowConfidence(
      azure([{ name: 'Mystery', price: 7, confidence: 0.2 }]),
      claude([{ name: 'Something else', price: 99 }]),
    )
    expect(result.items[0].price).toBe(7)
    expect(result.items[0].confidence).toBe(0.2)
  })

  it('never drops or reorders items, and keeps receipt totals from Azure', () => {
    const result = reconcileLowConfidence(
      azure([
        { name: 'A', price: 1, confidence: 0.2 },
        { name: 'B', price: 2, confidence: 0.99 },
        { name: 'C', price: 3 },
      ]),
      claude([{ name: 'A', price: 10 }]),
    )
    expect(result.items.map(i => i.name)).toEqual(['A', 'B', 'C'])
    expect(result.label).toBe('Azure Diner')
    expect(result.tax).toBe(3)
  })

  it('uses a Claude label when Azure had none', () => {
    const withoutLabel = { ...azure([{ name: 'A', price: 1, confidence: 0.2 }]), label: undefined }
    expect(reconcileLowConfidence(withoutLabel, claude([{ name: 'A', price: 1 }])).label).toBe('Claude Diner')
  })
})
