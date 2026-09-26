/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useShareActions } from '../src/hooks/useShareActions'
import type { Session } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session: Session = {
  id: 's', createdAt: '2026-09-18T18:00:00.000Z', label: 'Dinner',
  people: [{ id: 'p1', name: 'Bob' }],
  items: [{ id: 'i1', name: 'Pizza', price: 5, assignedTo: ['p1'] }],
  subtotal: 5, tax: 0, tip: 0, total: 5,
}

let api: ReturnType<typeof useShareActions>
function Probe() {
  api = useShareActions(session, [])
  return <span data-toast>{api.toast ?? ''}</span>
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  jest.useFakeTimers()
  // Force the clipboard path: predictable, and what a desktop browser does
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => {} }, configurable: true,
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Probe />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  jest.useRealTimers()
})

const toastText = () => container.querySelector('[data-toast]')!.textContent

describe('share toasts', () => {
  it('shows a toast and clears it after the timeout', async () => {
    await act(async () => { await api.shareLink() })
    expect(toastText()).toBe('Link copied to clipboard!')

    act(() => { jest.advanceTimersByTime(2500) })
    expect(toastText()).toBe('')
  })

  it('a second toast is not cut short by the first ones timer', async () => {
    await act(async () => { await api.shareLink() })
    act(() => { jest.advanceTimersByTime(2000) })   // first toast nearly expired

    await act(async () => { await api.copyText() })
    expect(toastText()).toBe('Copied to clipboard!')

    // The first toast's timer would have fired here and blanked the second
    act(() => { jest.advanceTimersByTime(500) })
    expect(toastText()).toBe('Copied to clipboard!')

    act(() => { jest.advanceTimersByTime(2000) })   // its own full 2500ms
    expect(toastText()).toBe('')
  })

  // Counted as a delta: React keeps a scheduler timer of its own, so the
  // absolute number is not ours to assert.
  it('clears the pending hide timer on unmount', async () => {
    await act(async () => { await api.shareLink() })
    const pending = jest.getTimerCount()

    act(() => root.unmount())

    expect(jest.getTimerCount()).toBe(pending - 1)

    root = createRoot(container)  // so afterEach can unmount cleanly
    act(() => root.render(<span />))
  })
})
