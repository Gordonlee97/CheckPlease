/**
 * @jest-environment jsdom
 */
import { act, type ReactNode, type MouseEvent } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import 'fake-indexeddb/auto' // the home screen reads split history
import { saveDraft, type SplitDraft } from '../src/lib/draft'
import { saveGroup } from '../src/lib/savedGroups'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
// A plain anchor, so a test can see whether a tap was held back for confirmation
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, onClick, className }: { href: string; children: ReactNode; onClick?: (e: MouseEvent) => void; className?: string }) => (
    // jsdom can't navigate, so every click is stopped after the page's own handler
    <a href={href} className={className} onClick={e => { onClick?.(e); e.preventDefault() }}>{children}</a>
  ),
}))

import HomePage from '../src/app/page'
import GroupsPage from '../src/app/groups/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

const draft: SplitDraft = {
  sessionId: 's1',
  createdAt: '2026-11-20T18:00:00.000Z',
  savedAt: '2026-11-20T18:05:00.000Z',
  step: 'assign',
  completedSteps: ['people', 'scan', 'review'],
  people: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: ['p1'] }],
  subtotal: 12, tax: 1, tip: 2, total: 15,
}

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

async function render(ui: ReactNode) {
  await act(async () => root.render(ui))
}

const groupCard = (name: string) =>
  [...container.querySelectorAll('a')].find(a => a.getAttribute('href')?.startsWith('/new?group=') && a.textContent?.includes(name))!

// Opening /new without ?resume discards the draft, so a tap that would get
// there must be confirmed first — as "+ New Split" already is.
describe.each([
  ['home screen', () => <HomePage />],
  ['groups page', () => <GroupsPage />],
])('tapping a saved group on the %s', (_, page) => {
  it('asks before discarding an unfinished split', async () => {
    const group = saveGroup({ name: 'Roommates', people: [{ name: 'Jo', color: '#888' }, { name: 'Kim', color: '#999' }] })
    saveDraft(draft)
    await render(page())

    act(() => { groupCard('Roommates').click() })

    expect(container.textContent).toContain('discards your unfinished split')
    const startFresh = [...container.querySelectorAll('a')].find(a => a.textContent?.includes('Start fresh'))!
    expect(startFresh.getAttribute('href')).toBe(`/new?group=${group.id}`)
  })

  it('goes straight to the group when there is nothing to lose', async () => {
    saveGroup({ name: 'Roommates', people: [{ name: 'Jo', color: '#888' }, { name: 'Kim', color: '#999' }] })
    await render(page())

    act(() => { groupCard('Roommates').click() })

    expect(container.textContent).not.toContain('discards your unfinished split')
  })
})
