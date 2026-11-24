/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { saveDraft, getDraft, type SplitDraft } from '../src/lib/draft'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import NewSplitPage from '../src/app/new/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

const draft: SplitDraft = {
  sessionId: 's1',
  createdAt: '2026-11-20T18:00:00.000Z',
  savedAt: '2026-11-20T18:05:00.000Z',
  step: 'review',
  completedSteps: ['people', 'scan'],
  people: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: [] }],
  subtotal: 12, tax: 0, tip: 0, total: 12,
  label: 'XJ#@ GRILL 0042',
}

beforeAll(() => {
  // jsdom has no layout, so element scrolling isn't implemented
  Element.prototype.scrollTo = () => {}
})

beforeEach(() => {
  localStorage.clear()
  saveDraft(draft)
  // The page reads ?resume from the real location
  window.history.replaceState({}, '', '/new?resume=1')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

// OCR often garbles the merchant name; clearing it must stick, not bring the
// scanned text back on the Summary, the share link and in history.
it('keeps the restaurant name cleared once the user empties it', async () => {
  await act(async () => root.render(<NewSplitPage />))
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Restaurant name (optional)"]')!
  expect(input.value).toBe('XJ#@ GRILL 0042')

  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(getDraft()?.label).toBeUndefined()
})
