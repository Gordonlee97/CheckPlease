import type { Item, Person } from './types'
import { minorUnitScale } from './money'

export interface AssignedItemShare {
  name: string
  price: number
  shared: boolean
}

export interface PersonShare {
  personId: string
  name: string
  itemSubtotal: number
  taxShare: number
  tipShare: number
  total: number
  assignedItems: AssignedItemShare[]
}

export function computeSplit(
  people: Person[],
  items: Item[],
  tax: number,
  tip: number,
  receiptTotal: number,
  currency?: string
): PersonShare[] {
  // Work in whole minor units (cents, or whole yen and won) so every share of
  // an item, and of tax and tip, adds back up to exactly the amount being
  // split, in the same steps the amounts are displayed in.
  const scale = minorUnitScale(currency)
  const toUnits = (n: number) => Math.round(n * scale)

  // Ids of people removed after assigning can linger on items; they must not
  // soak up a share that nobody pays.
  const currentIds = new Set(people.map(p => p.id))
  const payers = new Map(items.map(item => [item.id, item.assignedTo.filter(id => currentIds.has(id))]))

  const itemUnits = new Map<string, number>() // `${itemId}:${personId}` -> minor units
  items.forEach((item, itemIndex) => {
    const assignees = payers.get(item.id)!
    const n = assignees.length
    if (n === 0) return
    const priceUnits = toUnits(item.price)
    const base = Math.trunc(priceUnits / n)
    const extra = priceUnits - base * n
    // Rotate who absorbs the leftover units so they spread across people
    // instead of always landing on whoever was tapped first.
    assignees.forEach((personId, i) => {
      const slot = (i - itemIndex % n + n) % n
      itemUnits.set(`${item.id}:${personId}`, base + (slot < Math.abs(extra) ? Math.sign(extra) : 0))
    })
  })

  const subtotalUnits = people.map(person =>
    items.reduce((sum, item) => sum + (itemUnits.get(`${item.id}:${person.id}`) ?? 0), 0)
  )
  // Tax and tip follow each person's share of the whole receipt. Items nobody
  // has been assigned yet hold their portion back, so running totals on the
  // Assign step don't charge the first person for everyone's tax.
  const receiptItemUnits = items.reduce((sum, item) => sum + toUnits(item.price), 0)
  const assignedUnits = subtotalUnits.reduce((a, b) => a + b, 0)
  const weights = [...subtotalUnits, Math.max(0, receiptItemUnits - assignedUnits)]
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const taxUnits = allocateProportionally(toUnits(tax), weights, weightTotal)
  const tipUnits = allocateProportionally(toUnits(tip), weights, weightTotal)

  // Only adjust for a gap of a few minor units between the parts and the
  // printed total (OCR rounding). A larger gap means the inputs disagree, and
  // forcing it onto someone would hide that. The gap goes on the largest
  // share, on the first component that stays non-negative.
  const gap = toUnits(receiptTotal) - people.reduce((sum, _, p) => sum + subtotalUnits[p] + taxUnits[p] + tipUnits[p], 0)
  if (gap !== 0 && Math.abs(gap) <= MAX_CORRECTION_UNITS && people.length > 0) {
    const totalOf = (p: number) => subtotalUnits[p] + taxUnits[p] + tipUnits[p]
    const largest = people.reduce((best, _, p) => (totalOf(p) > totalOf(best) ? p : best), 0)
    const component = [taxUnits, tipUnits, subtotalUnits].find(c => c[largest] + gap >= 0)
    if (component) component[largest] += gap
  }

  return people.map((person, p) => {
    const assignedItems: AssignedItemShare[] = items
      .filter(item => item.assignedTo.includes(person.id))
      .map(item => ({
        name: item.name,
        price: (itemUnits.get(`${item.id}:${person.id}`) ?? 0) / scale,
        shared: payers.get(item.id)!.length > 1,
      }))

    return {
      personId: person.id,
      name: person.name,
      itemSubtotal: subtotalUnits[p] / scale,
      taxShare: taxUnits[p] / scale,
      tipShare: tipUnits[p] / scale,
      total: (subtotalUnits[p] + taxUnits[p] + tipUnits[p]) / scale,
      assignedItems,
    }
  })
}

// Up to 5 cents (or ¥5) of OCR rounding is absorbed; more is left visible
const MAX_CORRECTION_UNITS = 5

// Largest-remainder split of `amount` minor units in proportion to `weights`, so the
// parts always sum to `amount`. With no weight, nobody is charged (as before).
function allocateProportionally(amount: number, weights: number[], weightTotal: number): number[] {
  if (weightTotal <= 0 || amount === 0) return weights.map(() => 0)
  const exact = weights.map(w => (amount * w) / weightTotal)
  const parts = exact.map(x => Math.trunc(x))
  let left = amount - parts.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, rem: Math.abs(x - parts[i]) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (left === 0) break
    parts[i] += Math.sign(left)
    left -= Math.sign(left)
  }
  return parts
}
