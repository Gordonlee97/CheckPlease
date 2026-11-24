/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { encodeSession } from '../src/lib/share'
import type { Session } from '../src/lib/types'
import SharePage from '../src/app/share/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

const session = (label: string): Session => ({
  id: label,
  createdAt: '2026-11-20T18:00:00.000Z',
  label,
  people: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: ['p1', 'p2'] }],
  subtotal: 12, tax: 0, tip: 0, total: 12,
})

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

// Opening a second share link in a tab already on /share changes only the
// hash, so the page isn't remounted and kept showing the first split.
it('shows the new split when only the link hash changes', async () => {
  window.history.replaceState({}, '', `/share#${encodeSession(session('Taco House'))}`)
  await act(async () => root.render(<SharePage />))
  expect(container.textContent).toContain('Taco House')

  await act(async () => {
    window.location.hash = encodeSession(session('Noodle Bar'))
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })

  expect(container.textContent).toContain('Noodle Bar')
  expect(container.textContent).not.toContain('Taco House')
})

it('recovers from an invalid link once a valid one is opened', async () => {
  window.history.replaceState({}, '', '/share#not-a-session')
  await act(async () => root.render(<SharePage />))
  expect(container.textContent).toContain('Invalid or expired link')

  await act(async () => {
    window.location.hash = encodeSession(session('Noodle Bar'))
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })

  expect(container.textContent).toContain('Noodle Bar')
})
