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
  const computedSubtotal = items.reduce((sum, item) => sum + item.price, 0)

  const shares: PersonShare[] = people.map(person => {
    const assignedItems: AssignedItemShare[] = items
      .filter(item => item.assignedTo.includes(person.id))
      .map(item => ({
        name: item.name,
        price: round2(item.price / item.assignedTo.length),
        shared: item.assignedTo.length > 1,
      }))

    const itemSubtotal = assignedItems.reduce((sum, i) => sum + i.price, 0)
    const taxShare = computedSubtotal > 0 ? (itemSubtotal / computedSubtotal) * tax : 0
    const tipShare = computedSubtotal > 0 ? (itemSubtotal / computedSubtotal) * tip : 0

    return {
      personId: person.id,
      name: person.name,
      itemSubtotal: round2(itemSubtotal),
      taxShare: round2(taxShare),
      tipShare: round2(tipShare),
      total: round2(itemSubtotal + taxShare + tipShare),
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
