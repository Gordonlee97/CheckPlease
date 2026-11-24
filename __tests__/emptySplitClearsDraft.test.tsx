/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getDraft } from '../src/lib/draft'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import NewSplitPage from '../src/app/new/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/new')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function addPerson(name: string) {
  const input = container.querySelector('input[placeholder="Name"]') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Add')!.click())
}

// The save effect skipped an empty split, so the last saved draft (with the
// people just removed) stayed behind and "Resume split" kept offering it.
it('drops the saved draft once everyone has been removed', async () => {
  await act(async () => root.render(<NewSplitPage />))
  addPerson('Alex')
  expect(getDraft()?.people.map(p => p.name)).toEqual(['Alex'])

  act(() => (container.querySelector('[aria-label="Remove Alex"]') as HTMLButtonElement).click())

  expect(getDraft()).toBeNull()
})
