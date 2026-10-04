/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto' // All Splits reads split history
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=new'),
}))

import GroupsPage from '../src/app/groups/page'
import SplitsPage from '../src/app/splits/page'
import GroupEditorPage from '../src/app/groups/edit/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

// These pages slide in from 20px to the right. If the browser lays the page
// out on that first frame, a phone widens its layout viewport to fit and keeps
// it widened, leaving the page zoomed with the right edge cut off. The slide
// has to happen inside a <main> that clips horizontal overflow — the clip
// can't sit on the sliding element itself, and on <body> phones ignore it.
// jsdom has no layout, so this checks that structure; widths were measured
// in a browser.
describe.each([
  ['All Groups', GroupsPage],
  ['All Splits', SplitsPage],
  ['the group editor', GroupEditorPage],
])('%s: slide-in cannot widen the page', (_name, Page) => {
  it('slides an element inside <main>, and <main> clips horizontal overflow', async () => {
    await act(async () => root.render(<Page />))
    const sliding = container.querySelector('.animate-page-enter')
    expect(sliding).not.toBeNull()
    expect(sliding!.tagName).not.toBe('MAIN')
    expect(sliding!.closest('main')?.classList).toContain('overflow-x-clip')
  })
})
