/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import 'fake-indexeddb/auto' // the home screen reads split history
import { AddPeople } from '../src/components/steps/AddPeople'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=new'),
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }))

import GroupEditorPage from '../src/app/groups/edit/page'
import HomePage from '../src/app/page'

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

const nameInput = () => container.querySelector('input[placeholder="Name"]') as HTMLInputElement
const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!

function typeName(value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(nameInput(), value)
    nameInput().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// A tap on Add moves focus to the button, which closes a phone's keyboard,
// so each further name needed a tap back into the box first.
function addByTap(name: string) {
  typeName(name)
  act(() => button('Add').focus())
  act(() => button('Add').click())
}

// Phones otherwise capitalise and "correct" handles: jsmith99 → Jsmith99
function expectPlainTextEntry(input: HTMLInputElement) {
  expect(input.getAttribute('autocapitalize')).toBe('none')
  expect(input.getAttribute('autocorrect')).toBe('off')
  expect(input.getAttribute('spellcheck')).toBe('false')
}

describe('Venmo handle boxes take the handle as typed', () => {
  it('on the Who is splitting step', () => {
    act(() => root.render(<AddPeople onDone={jest.fn()} />))
    addByTap('Alex')
    expectPlainTextEntry(container.querySelector('input[placeholder="venmo handle (optional)"]')!)
  })

  it('in the group editor', async () => {
    await act(async () => root.render(<GroupEditorPage />))
    addByTap('Alex')
    expectPlainTextEntry(container.querySelector('input[placeholder="venmo handle (optional)"]')!)
  })

  it('for your own handle on the home screen', async () => {
    await act(async () => root.render(<HomePage />))
    act(() => button('Add your Venmo').click())
    expectPlainTextEntry(container.querySelector('input[placeholder="@yourhandle"]')!)
  })
})
