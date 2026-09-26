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

// Wired the way the real screens use it: buttons that call the actions
function Probe() {
  const { toast, shareLink, copyText } = useShareActions(session, [])
  return (
    <>
      <span data-toast>{toast ?? ''}</span>
      <button data-share onClick={shareLink}>Share link</button>
      <button data-copy onClick={copyText}>Copy text</button>
    </>
  )
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
const click = async (sel: string) => {
  const btn = container.querySelector(sel) as HTMLButtonElement
  await act(async () => { btn.click() })
}

describe('share toasts', () => {
  it('shows a toast and clears it after the timeout', async () => {
    await click('[data-share]')
    expect(toastText()).toBe('Link copied to clipboard!')

    act(() => { jest.advanceTimersByTime(2500) })
    expect(toastText()).toBe('')
  })

  it('does not let the first toast timer cut the second one short', async () => {
    await click('[data-share]')
    act(() => { jest.advanceTimersByTime(2000) })   // first toast nearly expired

    await click('[data-copy]')
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
    await click('[data-share]')
    const pending = jest.getTimerCount()

    act(() => root.unmount())

    expect(jest.getTimerCount()).toBe(pending - 1)

    root = createRoot(container)  // so afterEach can unmount cleanly
    act(() => root.render(<span />))
  })
})
