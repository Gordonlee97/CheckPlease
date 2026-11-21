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

  // Stripping everything outside [a-z0-9] turned every Korean or Japanese name
  // into "", so all of them shared one price.
  it('matches names written in other scripts by their own letters', () => {
    const result = reconcileLowConfidence(
      azure([{ name: '김치찌개', price: 900, confidence: 0.4 }]),
      claude([{ name: '김치찌개', price: 9000 }, { name: '소주', price: 5000 }]),
    )
    expect(result.items[0].price).toBe(9000)
  })

  it('pairs repeated names in the order they appear', () => {
    const result = reconcileLowConfidence(
      azure([
        { name: 'Beer', price: 2, confidence: 0.4 },
        { name: 'Beer', price: 8, confidence: 0.99 },
      ]),
      claude([{ name: 'Beer', price: 6 }, { name: 'Beer', price: 8 }]),
    )
    expect(result.items.map(i => i.price)).toEqual([6, 8])
  })

  it('leaves a repeated name alone when the two readers list it a different number of times', () => {
    const result = reconcileLowConfidence(
      azure([
        { name: 'Beer', price: 2, confidence: 0.4 },
        { name: 'Beer', price: 6, confidence: 0.99 },
      ]),
      claude([{ name: 'Beer', price: 6 }]),
    )
    expect(result.items[0].price).toBe(2)
    expect(result.items[0].confidence).toBe(0.4)
  })

  it('never matches a name with no letters or digits', () => {
    const result = reconcileLowConfidence(
      azure([{ name: '***', price: 2, confidence: 0.4 }]),
      claude([{ name: '---', price: 50 }]),
    )
    expect(result.items[0].price).toBe(2)
  })
})
