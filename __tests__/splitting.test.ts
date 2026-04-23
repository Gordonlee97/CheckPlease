import { computeSplit } from '../src/lib/splitting'
import { Person, Item } from '../src/lib/types'

const gordon: Person = { id: 'g', name: 'Gordon' }
const sarah: Person = { id: 's', name: 'Sarah' }
const mike: Person = { id: 'm', name: 'Mike' }

describe('computeSplit', () => {
  it('single person takes all items, tax, and tip', () => {
    const items: Item[] = [{ id: '1', name: 'Burger', price: 14, assignedTo: ['g'] }]
    const result = computeSplit([gordon], items, 2, 4, 20)
    expect(result).toHaveLength(1)
    expect(result[0].itemSubtotal).toBe(14)
    expect(result[0].taxShare).toBe(2)
    expect(result[0].tipShare).toBe(4)
    expect(result[0].total).toBe(20)
  })

  it('two people split proportionally by subtotal', () => {
    const items: Item[] = [
      { id: '1', name: 'Burger', price: 14, assignedTo: ['g'] },
      { id: '2', name: 'Salad', price: 10, assignedTo: ['s'] },
    ]
    const result = computeSplit([gordon, sarah], items, 2.4, 4.8, 31.2)
    const g = result.find(r => r.personId === 'g')!
    const s = result.find(r => r.personId === 's')!
    expect(g.itemSubtotal).toBe(14)
    expect(g.taxShare).toBe(1.4)
    expect(g.tipShare).toBe(2.8)
    expect(g.total).toBe(18.2)
    expect(s.total).toBe(13)
    expect(g.total + s.total).toBeCloseTo(31.2, 10)
  })

  it('shared item splits cost equally among assignees', () => {
    const items: Item[] = [
      { id: '1', name: 'Burger', price: 14, assignedTo: ['g'] },
      { id: '2', name: 'Nachos', price: 12, assignedTo: ['g', 's'] },
    ]
    const result = computeSplit([gordon, sarah], items, 0, 0, 26)
    const g = result.find(r => r.personId === 'g')!
    const s = result.find(r => r.personId === 's')!
    expect(g.itemSubtotal).toBe(20)
    expect(s.itemSubtotal).toBe(6)
    expect(g.total + s.total).toBe(26)
  })

  it('rounding guarantee: totals sum exactly to receiptTotal', () => {
    const items: Item[] = [{ id: '1', name: 'Shared', price: 10, assignedTo: ['g', 's', 'm'] }]
    const result = computeSplit([gordon, sarah, mike], items, 1, 2, 13)
    const sum = result.reduce((acc, r) => acc + r.total, 0)
    expect(Math.round(sum * 100)).toBe(Math.round(13 * 100))
  })

  it('marks shared items and records split price per person', () => {
    const items: Item[] = [{ id: '1', name: 'Nachos', price: 12, assignedTo: ['g', 's'] }]
    const result = computeSplit([gordon, sarah], items, 0, 0, 12)
    const g = result.find(r => r.personId === 'g')!
    expect(g.assignedItems[0].shared).toBe(true)
    expect(g.assignedItems[0].price).toBe(6)
  })

  it('component invariant: itemSubtotal + taxShare + tipShare === total for every person', () => {
    const items: Item[] = [{ id: '1', name: 'Shared', price: 10, assignedTo: ['g', 's', 'm'] }]
    const result = computeSplit([gordon, sarah, mike], items, 1, 2, 13)
    for (const share of result) {
      const componentSum = Math.round((share.itemSubtotal + share.taxShare + share.tipShare) * 100)
      expect(componentSum).toBe(Math.round(share.total * 100))
    }
  })

  it('handles zero tax and tip with rounding', () => {
    const items: Item[] = [{ id: '1', name: 'Shared', price: 10, assignedTo: ['g', 's', 'm'] }]
    const result = computeSplit([gordon, sarah, mike], items, 0, 0, 10)
    const sum = result.reduce((acc, r) => acc + r.total, 0)
    expect(Math.round(sum * 100)).toBe(1000)
    for (const share of result) {
      const componentSum = Math.round((share.itemSubtotal + share.taxShare + share.tipShare) * 100)
      expect(componentSum).toBe(Math.round(share.total * 100))
    }
  })

  it('shared item price per person is rounded to 2 decimals', () => {
    const items: Item[] = [{ id: '1', name: 'Nachos', price: 10, assignedTo: ['g', 's', 'm'] }]
    const result = computeSplit([gordon, sarah, mike], items, 0, 0, 10)
    for (const share of result) {
      for (const item of share.assignedItems) {
        const str = item.price.toString()
        const decimals = str.includes('.') ? str.split('.')[1].length : 0
        expect(decimals).toBeLessThanOrEqual(2)
      }
    }
  })
})
