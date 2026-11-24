/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Review, type ReviewResult } from '../src/components/steps/Review'
import type { Item } from '../src/lib/types'

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

// A scan that read the name but not the amount leaves price 0
const scanned: Item[] = [
  { id: '1', name: 'Tacos', price: 12, assignedTo: [] },
  { id: '2', name: 'Mystery item', price: 0, assignedTo: [] },
]

function render(items: Item[]) {
  const onDone = jest.fn()
  const onReadyChange = jest.fn()
  const ref = { current: null as { submit: () => void } | null }
  act(() => root.render(
    <Review ref={ref} items={items} tax={0} tip={0} onDone={onDone} onReadyChange={onReadyChange} />
  ))
  return { onDone, onReadyChange, ref }
}

const priceInputs = () => [...container.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')]
const ready = (onReadyChange: jest.Mock) => onReadyChange.mock.calls.at(-1)?.[0]

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Review: item missing a price', () => {
  it('blocks continuing and says what is wrong', () => {
    const { onReadyChange, onDone, ref } = render(scanned)
    expect(ready(onReadyChange)).toBe(false)
    expect(container.textContent).toContain('needs a price')

    act(() => ref.current!.submit())
    expect(onDone).not.toHaveBeenCalled()
  })

  it('never silently drops the item from the split', () => {
    const { onDone, ref } = render(scanned)
    act(() => ref.current!.submit())
    expect(onDone).not.toHaveBeenCalled() // dropping "Mystery item" would lose money
  })

  it('unblocks once a price is typed, keeping both items', () => {
    const { onReadyChange, onDone, ref } = render(scanned)
    type(priceInputs()[1], '8.50')
    expect(ready(onReadyChange)).toBe(true)

    act(() => ref.current!.submit())
    expect(onDone).toHaveBeenCalledTimes(1)
    const result = onDone.mock.calls[0][0] as ReviewResult
    expect(result.items.map(i => [i.name, i.price])).toEqual([['Tacos', 12], ['Mystery item', 8.5]])
    expect(result.currency).toBe('USD')
  })

  it('unblocks when the item is deleted instead', () => {
    const { onReadyChange, onDone, ref } = render(scanned)
    const remove = container.querySelectorAll('button[aria-label="Remove item"]')[1] as HTMLButtonElement
    act(() => remove.click())
    expect(ready(onReadyChange)).toBe(true)

    act(() => ref.current!.submit())
    expect((onDone.mock.calls[0][0] as ReviewResult).items.map(i => i.name)).toEqual(['Tacos'])
  })

  it('ignores a completely empty row', () => {
    const { onReadyChange, onDone, ref } = render([scanned[0]])
    const addItem = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Add item'))!
    act(() => addItem.click())
    expect(ready(onReadyChange)).toBe(true)

    act(() => ref.current!.submit())
    expect((onDone.mock.calls[0][0] as ReviewResult).items.map(i => i.name)).toEqual(['Tacos'])
  })

  it('blocks a row that has a price but no name', () => {
    const { onReadyChange } = render([scanned[0]])
    const addItem = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Add item'))!
    act(() => addItem.click())
    type(priceInputs()[1], '4.00')
    expect(ready(onReadyChange)).toBe(false)
    expect(container.textContent).toContain('needs a name')
  })
})

describe('Review: currency', () => {
  const priced: Item[] = [{ id: '1', name: 'Kaffee', price: 4, assignedTo: [] }]

  function renderWith(currency?: string) {
    const onDone = jest.fn()
    const ref = { current: null as { submit: () => void } | null }
    act(() => root.render(
      <Review ref={ref} items={priced} tax={0} tip={0} currency={currency} onDone={onDone} />
    ))
    return { onDone, ref }
  }

  const select = () => container.querySelector('select') as HTMLSelectElement

  it('starts from the detected currency and prefixes amounts with its symbol', () => {
    renderWith('EUR')
    expect(select().value).toBe('EUR')
    expect(container.textContent).toContain('€')
  })

  it('defaults to USD when the receipt did not say', () => {
    renderWith(undefined)
    expect(select().value).toBe('USD')
  })

  it('lets the currency be corrected, and reports it on continue', () => {
    const { onDone, ref } = renderWith('USD')

    act(() => {
      select().value = 'GBP'
      select().dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => ref.current!.submit())

    expect((onDone.mock.calls[0][0] as ReviewResult).currency).toBe('GBP')
    expect(container.textContent).toContain('£')
  })
})

// A comp or happy-hour line lowers the bill. Clamping it to 0 or blocking on
// it made people delete it, so the group overpaid by that amount.
describe('Review: discount lines', () => {
  const withDiscount: Item[] = [
    { id: '1', name: 'Tacos', price: 30, assignedTo: [] },
    { id: '2', name: 'Happy hour', price: -10, assignedTo: [] },
  ]

  it('keeps a scanned negative line and lets the user continue', () => {
    const { onDone, onReadyChange, ref } = render(withDiscount)
    expect(priceInputs()[0 + 1].value).toBe('-10.00')
    expect(ready(onReadyChange)).toBe(true)
    act(() => ref.current!.submit())
    const result = onDone.mock.calls[0][0] as ReviewResult
    expect(result.items.map(i => i.price)).toEqual([30, -10])
    expect(result.total).toBe(20)
  })

  it('does not clamp a typed negative price to zero', () => {
    render(withDiscount)
    const discount = priceInputs()[1]
    act(() => discount.focus())
    type(discount, '-5')
    act(() => discount.blur())
    expect(discount.value).toBe('-5.00')
  })

  it('still clamps tax and tip, which are never negative', () => {
    render(withDiscount)
    const tax = priceInputs().at(-2)!
    act(() => tax.focus())
    type(tax, '-3')
    act(() => tax.blur())
    expect(tax.value).toBe('0.00')
  })
})

