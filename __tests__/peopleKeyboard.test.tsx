/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AddPeople } from '../src/components/steps/AddPeople'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=new'),
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }))

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

describe('adding people keeps the name box focused', () => {
  it('on the Who is splitting step', () => {
    act(() => root.render(<AddPeople onDone={jest.fn()} />))
    addByTap('Alex')
    expect(container.textContent).toContain('Alex')
    expect(document.activeElement).toBe(nameInput())
  })

  it('in the group editor', async () => {
    await act(async () => root.render(<GroupEditorPage />))
    addByTap('Alex')
    expect(container.textContent).toContain('Alex')
    expect(document.activeElement).toBe(nameInput())
  })
})
