/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Assign } from '../src/components/steps/Assign'
import { computeSplit } from '../src/lib/splitting'
import type { Item, Person } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const people: Person[] = [
  { id: 'a', name: 'Alex', color: '#ff0000' },
  { id: 'b', name: 'Sam', color: '#00ff00' },
]
const items: Item[] = [
  { id: '1', name: 'Burger', price: 20, assignedTo: [] },
  { id: '2', name: 'Nachos', price: 12, assignedTo: [] },
]
// Tax 3.20 and tip 6.40 on a 32.00 subtotal: 10% and 20% of what you ordered
const tax = 3.2, tip = 6.4, total = 41.6

function render() {
  act(() => root.render(
    <Assign people={people} items={items} tax={tax} tip={tip} total={total} onDone={jest.fn()} />
  ))
}

const runningTotal = (name: string) =>
  container.querySelector(`[data-testid="running-total"][data-person="${name}"]`)?.textContent
const tap = (label: string) =>
  act(() => (container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click())

describe('Assign: running totals', () => {
  it('starts everyone at zero', () => {
    render()
    expect(runningTotal('Alex')).toContain('$0.00')
    expect(runningTotal('Sam')).toContain('$0.00')
  })

  it('updates as items are tapped, with tax and tip included', () => {
    render()
    tap('Alex — Burger')
    expect(runningTotal('Alex')).toContain('$26.00') // 20 + 2 tax + 4 tip
    tap('Sam — Nachos')
    tap('Alex — Nachos')
    expect(runningTotal('Alex')).toContain('$33.80') // + half of 12 × 1.3
    expect(runningTotal('Sam')).toContain('$7.80')
  })

  it('matches the Totals screen once every item is assigned', () => {
    render()
    tap('Alex — Burger')
    tap('Assign Nachos to everyone')
    const assigned = items.map(i => ({ ...i, assignedTo: i.id === '1' ? ['a'] : ['a', 'b'] }))
    for (const share of computeSplit(people, assigned, tax, tip, total)) {
      expect(runningTotal(share.name)).toContain(`$${share.total.toFixed(2)}`)
    }
  })
})
