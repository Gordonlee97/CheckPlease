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
        price: item.price / item.assignedTo.length,
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
  if (diff !== 0 && shares.length > 0) {
    const maxIdx = shares.reduce((mi, s, i, arr) => (s.total > arr[mi].total ? i : mi), 0)
    shares[maxIdx].total = round2(shares[maxIdx].total + diff)
  }

  return shares
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
