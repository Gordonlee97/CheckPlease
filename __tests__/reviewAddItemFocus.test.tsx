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

const items: Item[] = [{ id: '1', name: 'Tacos', price: 12, assignedTo: [] }]

const nameInputs = () => [...container.querySelectorAll<HTMLInputElement>('input[aria-label="Item name"]')]
const addItemButton = () => [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Add item'))!

describe('Review: + Add item', () => {
  it('puts the cursor in the new row, ready to type its name', () => {
    act(() => root.render(<Review items={items} tax={0} tip={0} onDone={jest.fn()} />))
    act(() => addItemButton().click())
    expect(nameInputs()).toHaveLength(2)
    expect(document.activeElement).toBe(nameInputs()[1])
  })

  it('does not steal focus when the screen first opens', () => {
    act(() => root.render(<Review items={items} tax={0} tip={0} onDone={jest.fn()} />))
    expect(document.activeElement).toBe(document.body)
  })
})
