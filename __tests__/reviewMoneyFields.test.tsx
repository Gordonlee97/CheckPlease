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

const items: Item[] = [{ id: '1', name: 'Tacos', price: 12, assignedTo: [] }]

function render(tax: number, tip: number) {
  const onDone = jest.fn()
  const ref = { current: null as { submit: () => void } | null }
  act(() => root.render(<Review ref={ref} items={items} tax={tax} tip={tip} onDone={onDone} />))
  return { onDone, ref }
}

function field(label: string): HTMLInputElement {
  const el = [...container.querySelectorAll('label')].find(l => l.textContent === label)!
  return document.getElementById(el.htmlFor) as HTMLInputElement
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Review: money fields', () => {
  // Typing "15" into a box holding "0.00" used to give "0.0015", which
  // formatted to 0.00, or "150.00" depending on where the cursor landed.
  it('leaves a zero tip and tax empty, so typing replaces nothing', () => {
    render(0, 0)
    expect(field('Tip').value).toBe('')
    expect(field('Tip').placeholder).toBe('0.00')
    expect(field('Tax').value).toBe('')
    expect(field('Tax').placeholder).toBe('0.00')
  })

  it('still shows an amount the scan did read', () => {
    render(2.5, 10)
    expect(field('Tax').value).toBe('2.50')
    expect(field('Tip').value).toBe('10.00')
  })

  it('reports an untouched empty tip as zero', () => {
    const { onDone, ref } = render(0, 0)
    act(() => ref.current!.submit())
    const result = onDone.mock.calls[0][0] as ReviewResult
    expect(result.tip).toBe(0)
    expect(result.tax).toBe(0)
  })

  it('takes a tip typed into the empty box at face value', () => {
    const { onDone, ref } = render(0, 0)
    act(() => field('Tip').focus())
    type(field('Tip'), '15')
    act(() => field('Tip').blur())
    expect(field('Tip').value).toBe('15.00')
    act(() => ref.current!.submit())
    expect((onDone.mock.calls[0][0] as ReviewResult).tip).toBe(15)
  })

  it('selects an existing amount on focus, so typing replaces it', () => {
    render(2.5, 10)
    for (const input of [field('Tax'), field('Tip'), container.querySelector<HTMLInputElement>('input[aria-label^="Price for"]')!]) {
      act(() => input.focus())
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length])
    }
  })

  it('closes the keyboard when Enter is pressed in Tip, the last field', () => {
    render(0, 10)
    act(() => field('Tip').focus())
    act(() => { field('Tip').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(document.activeElement).not.toBe(field('Tip'))
  })
})
