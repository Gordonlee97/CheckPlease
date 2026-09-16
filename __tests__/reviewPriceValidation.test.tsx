/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Review } from '../src/components/steps/Review'
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
    const items = onDone.mock.calls[0][0] as Item[]
    expect(items.map(i => [i.name, i.price])).toEqual([['Tacos', 12], ['Mystery item', 8.5]])
  })

  it('unblocks when the item is deleted instead', () => {
    const { onReadyChange, onDone, ref } = render(scanned)
    const remove = container.querySelectorAll('button[aria-label="Remove item"]')[1] as HTMLButtonElement
    act(() => remove.click())
    expect(ready(onReadyChange)).toBe(true)

    act(() => ref.current!.submit())
    expect((onDone.mock.calls[0][0] as Item[]).map(i => i.name)).toEqual(['Tacos'])
  })

  it('ignores a completely empty row', () => {
    const { onReadyChange, onDone, ref } = render([scanned[0]])
    const addItem = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Add item'))!
    act(() => addItem.click())
    expect(ready(onReadyChange)).toBe(true)

    act(() => ref.current!.submit())
    expect((onDone.mock.calls[0][0] as Item[]).map(i => i.name)).toEqual(['Tacos'])
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
