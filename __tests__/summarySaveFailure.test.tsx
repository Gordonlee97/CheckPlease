/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { saveDraft, getDraft, type SplitDraft } from '../src/lib/draft'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

let finishSave: (() => void) | null = null
const saveSession = jest.fn()
jest.mock('../src/lib/storage', () => ({
  saveSession: (...args: unknown[]) => saveSession(...args),
}))

import NewSplitPage from '../src/app/new/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

const draft: SplitDraft = {
  sessionId: 's1',
  createdAt: '2026-11-20T18:00:00.000Z',
  savedAt: '2026-11-20T18:05:00.000Z',
  step: 'summary',
  completedSteps: ['people', 'scan', 'review', 'assign'],
  people: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: ['p1', 'p2'] }],
  subtotal: 12, tax: 0, tip: 0, total: 12,
}

beforeAll(() => {
  // jsdom has no layout, so element scrolling isn't implemented
  Element.prototype.scrollTo = () => {}
})

beforeEach(() => {
  localStorage.clear()
  push.mockReset()
  saveSession.mockReset()
  finishSave = null
  saveDraft(draft)
  // The page reads ?resume from the real location, not useSearchParams
  window.history.replaceState({}, '', '/new?resume=1')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const doneButton = () =>
  [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Done') as HTMLButtonElement

describe('Summary: Done when saving to history fails', () => {
  it('says so, keeps the split, and lets Done be tried again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    saveSession.mockRejectedValueOnce(new Error('QuotaExceededError'))
    await act(async () => root.render(<NewSplitPage />))

    await act(async () => doneButton().click())

    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/couldn.t save/i)
    expect(push).not.toHaveBeenCalled()
    expect(getDraft()).not.toBeNull()
    expect(doneButton().disabled).toBe(false)
  })

  it('ignores a second tap while the first save is still running', async () => {
    saveSession.mockReturnValue(new Promise<void>(res => { finishSave = res }))
    await act(async () => root.render(<NewSplitPage />))

    await act(async () => doneButton().click())
    await act(async () => doneButton().click())
    expect(saveSession).toHaveBeenCalledTimes(1)

    await act(async () => finishSave!())
    expect(push).toHaveBeenCalledWith('/')
  })
})
