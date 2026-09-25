/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const replace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace }),
  useSearchParams: () => new URLSearchParams('id=abc'),
}))

// Held open so the render can be inspected mid-read, the way a slow device sees it
let resolveSession: (s: unknown) => void
jest.mock('../src/lib/storage', () => ({
  getSession: jest.fn(() => new Promise(res => { resolveSession = res })),
  deleteSession: jest.fn(),
}))

import HistoryPage from '../src/app/history/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  replace.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const session = {
  id: 'abc',
  createdAt: '2026-09-18T18:00:00.000Z',
  label: 'Cafe',
  people: [{ id: 'p1', name: 'Ada', color: '#c9a84c' }],
  items: [{ id: 'i1', name: 'Coffee', price: 4, assignedTo: ['p1'] }],
  tax: 0,
  tip: 0,
  total: 4,
}

describe('history page: waiting on the saved split', () => {
  it('says it is loading instead of rendering an empty page', () => {
    act(() => root.render(<HistoryPage />))

    expect(container.textContent).toContain('Loading split')
  })

  it('announces the wait to assistive tech', () => {
    act(() => root.render(<HistoryPage />))

    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(status!.textContent).toContain('Loading split')
  })

  it('replaces the loading state with the split once it arrives', async () => {
    act(() => root.render(<HistoryPage />))
    await act(async () => { resolveSession(session); })

    expect(container.textContent).toContain('Cafe')
    expect(container.textContent).not.toContain('Loading split')
    expect(replace).not.toHaveBeenCalled()
  })
})
