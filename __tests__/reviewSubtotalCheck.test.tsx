/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Review } from '../src/components/steps/Review'
import { saveDraft } from '../src/lib/draft'
import type { Item } from '../src/lib/types'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import NewSplitPage from '../src/app/new/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

// jsdom has no element scrolling; the wizard scrolls to the top on each step
beforeAll(() => { Element.prototype.scrollTo = () => {} })

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.history.replaceState({}, '', '/')
})

// The scan read $30.00 of items but only found two lines worth $20.00
const items: Item[] = [
  { id: '1', name: 'Tacos', price: 12, assignedTo: [] },
  { id: '2', name: 'Soda', price: 8, assignedTo: [] },
]

const warning = () => container.querySelector('[data-testid="subtotal-mismatch"]')

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Review: items vs. the receipt subtotal', () => {
  function render(receiptSubtotal?: number) {
    act(() => root.render(
      <Review items={items} tax={0} tip={0} receiptSubtotal={receiptSubtotal} onDone={jest.fn()} />
    ))
  }

  it('warns when the items fall short of the receipt, naming both amounts', () => {
    render(30)
    expect(warning()?.textContent).toContain('$20.00')
    expect(warning()?.textContent).toContain('$30.00')
  })

  it('says nothing when they match', () => {
    render(20)
    expect(warning()).toBeNull()
  })

  it('says nothing when the receipt had no subtotal (or items were typed in)', () => {
    render(0)
    expect(warning()).toBeNull()
    render(undefined)
    expect(warning()).toBeNull()
  })

  it('clears once the missing item is added', () => {
    render(30)
    act(() => [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Add item'))!.click())
    const names = container.querySelectorAll<HTMLInputElement>('input[aria-label="Item name"]')
    const prices = container.querySelectorAll<HTMLInputElement>('input[aria-label="Item price"], input[aria-label^="Price for"]')
    type(names[2], 'Churros')
    type(prices[2], '10')
    expect(warning()).toBeNull()
  })

  it('does not block continuing: the receipt can be the one that is wrong', () => {
    const onReadyChange = jest.fn()
    act(() => root.render(
      <Review items={items} tax={0} tip={0} receiptSubtotal={30} onDone={jest.fn()} onReadyChange={onReadyChange} />
    ))
    expect(onReadyChange.mock.calls.at(-1)?.[0]).toBe(true)
  })
})

describe('new split: the receipt subtotal survives editing', () => {
  // Review's edits overwrite the draft's subtotal with the items sum, so the
  // scanned figure has to be kept separately or the check silently vanishes.
  it('still warns after going on to Assign and coming back', () => {
    saveDraft({
      sessionId: 's1', createdAt: '2026-09-27T00:00:00.000Z', savedAt: '2026-09-27T00:00:00.000Z',
      step: 'assign', completedSteps: ['people', 'scan', 'review'],
      people: [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Sam' }],
      items, subtotal: 20, tax: 0, tip: 0, total: 20, receiptSubtotal: 30,
    })
    window.history.replaceState({}, '', '/new?resume=1')
    act(() => root.render(<NewSplitPage />))

    const back = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Back'))!
    act(() => back.click())
    expect(warning()?.textContent).toContain('$30.00')
  })
})
