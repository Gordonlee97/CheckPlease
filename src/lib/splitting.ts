import type { Item, Person } from './types'

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
  receiptTotal: number
): PersonShare[] {
  // Work in whole cents so every share of an item, and of tax and tip, adds
  // back up to exactly the amount being split.
  // Ids of people removed after assigning can linger on items; they must not
  // soak up a share that nobody pays.
  const currentIds = new Set(people.map(p => p.id))
  const payers = new Map(items.map(item => [item.id, item.assignedTo.filter(id => currentIds.has(id))]))

  const itemCents = new Map<string, number>() // `${itemId}:${personId}` -> cents
  items.forEach((item, itemIndex) => {
    const assignees = payers.get(item.id)!
    const n = assignees.length
    if (n === 0) return
    const priceCents = toCents(item.price)
    const base = Math.trunc(priceCents / n)
    const extra = priceCents - base * n
    // Rotate who absorbs the leftover pennies so they spread across people
    // instead of always landing on whoever was tapped first.
    assignees.forEach((personId, i) => {
      const slot = (i - itemIndex % n + n) % n
      itemCents.set(`${item.id}:${personId}`, base + (slot < Math.abs(extra) ? Math.sign(extra) : 0))
    })
  })

  const subtotalCents = people.map(person =>
    items.reduce((sum, item) => sum + (itemCents.get(`${item.id}:${person.id}`) ?? 0), 0)
  )
  // Tax and tip follow each person's share of the whole receipt. Items nobody
  // has been assigned yet hold their portion back, so running totals on the
  // Assign step don't charge the first person for everyone's tax.
  const receiptItemCents = items.reduce((sum, item) => sum + toCents(item.price), 0)
  const assignedCents = subtotalCents.reduce((a, b) => a + b, 0)
  const weights = [...subtotalCents, Math.max(0, receiptItemCents - assignedCents)]
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const taxCents = allocateProportionally(toCents(tax), weights, weightTotal)
  const tipCents = allocateProportionally(toCents(tip), weights, weightTotal)

  const shares: PersonShare[] = people.map((person, p) => {
    const assignedItems: AssignedItemShare[] = items
      .filter(item => item.assignedTo.includes(person.id))
      .map(item => ({
        name: item.name,
        price: (itemCents.get(`${item.id}:${person.id}`) ?? 0) / 100,
        shared: payers.get(item.id)!.length > 1,
      }))

    return {
      personId: person.id,
      name: person.name,
      itemSubtotal: subtotalCents[p] / 100,
      taxShare: taxCents[p] / 100,
      tipShare: tipCents[p] / 100,
      total: (subtotalCents[p] + taxCents[p] + tipCents[p]) / 100,
      assignedItems,
    }
  })

  const computedTotal = round2(shares.reduce((sum, s) => sum + s.total, 0))
  const diff = round2(receiptTotal - computedTotal)
  // Only adjust for penny-level discrepancies (OCR rounding). A large diff means
  // the inputs are inconsistent; forcing it into a component creates negative values.
  if (diff !== 0 && Math.abs(diff) <= 0.05 && shares.length > 0) {
    const maxIdx = shares.reduce((mi, s, i, arr) => (s.total > arr[mi].total ? i : mi), 0)
    const s = shares[maxIdx]
    if (s.taxShare > 0) {
      s.taxShare = round2(s.taxShare + diff)
    } else if (s.tipShare > 0) {
      s.tipShare = round2(s.tipShare + diff)
    } else {
      s.itemSubtotal = round2(s.itemSubtotal + diff)
    }
    s.total = round2(s.itemSubtotal + s.taxShare + s.tipShare)
  }

  return shares
}

function toCents(n: number): number {
  return Math.round(n * 100)
}

// Largest-remainder split of `amount` cents in proportion to `weights`, so the
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
