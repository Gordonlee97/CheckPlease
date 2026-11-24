/**
 * @jest-environment jsdom
 */
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { cleanVenmoHandle, setMyVenmoHandle, getMyVenmoHandle } from '../src/lib/userSettings'
import { AddPeople } from '../src/components/steps/AddPeople'
import type { Person } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// A leading space (pasted, or autocomplete) hid the "@" from the strip, so
// " @alice" was saved as "@alice" and the Venmo link pointed at "@@alice".
describe('cleanVenmoHandle', () => {
  it('trims before dropping the @', () => {
    expect(cleanVenmoHandle(' @alice ')).toBe('alice')
    expect(cleanVenmoHandle('@alice')).toBe('alice')
    expect(cleanVenmoHandle('alice')).toBe('alice')
    expect(cleanVenmoHandle('  ')).toBe('')
  })

  it('is what your own handle is saved through', () => {
    localStorage.clear()
    setMyVenmoHandle(' @me')
    expect(getMyVenmoHandle()).toBe('me')
  })
})

describe('Venmo handle on the people step', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function typeInto(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('saves a handle typed with a leading space and @ without the @', () => {
    const onDone = jest.fn()
    const ref = createRef<{ submit: () => void }>()
    act(() => root.render(<AddPeople onDone={onDone} ref={ref} />))
    typeInto(container.querySelector('input[placeholder="Name"]') as HTMLInputElement, 'Alice')
    act(() => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Add')!.click())

    typeInto(container.querySelector('[aria-label^="Venmo handle for Alice"]') as HTMLInputElement, ' @alice')
    act(() => ref.current!.submit())

    expect((onDone.mock.calls[0][0] as Person[])[0].venmoHandle).toBe('alice')
  })
})
