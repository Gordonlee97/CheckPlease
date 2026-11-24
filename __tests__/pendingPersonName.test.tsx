/**
 * @jest-environment jsdom
 */
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AddPeople } from '../src/components/steps/AddPeople'
import { getSavedGroups } from '../src/lib/savedGroups'
import type { Person } from '../src/lib/types'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=new'),
}))

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

const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const nameInput = () => container.querySelector('input[placeholder="Name"]') as HTMLInputElement

function add(name: string) {
  typeInto(nameInput(), name)
  act(() => button('Add').click())
}

// Typing a name and going straight to "That's Everyone" is natural at a table;
// dropping that person silently moves their share onto everyone else.
describe('a name typed but not yet added', () => {
  it('is included when the people step is finished', () => {
    const onDone = jest.fn()
    const ref = createRef<{ submit: () => void }>()
    act(() => root.render(<AddPeople onDone={onDone} ref={ref} />))

    add('Alice')
    add('Bob')
    typeInto(nameInput(), '  Carol ')
    act(() => ref.current!.submit())

    const people: Person[] = onDone.mock.calls[0][0]
    expect(people.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('is not added twice when it matches someone already listed', () => {
    const onDone = jest.fn()
    const ref = createRef<{ submit: () => void }>()
    act(() => root.render(<AddPeople onDone={onDone} ref={ref} />))

    add('Alice')
    add('Bob')
    typeInto(nameInput(), 'bob')
    act(() => ref.current!.submit())

    expect(onDone.mock.calls[0][0].map((p: Person) => p.name)).toEqual(['Alice', 'Bob'])
  })

  it('is saved with the group in the group editor', () => {
    act(() => root.render(<GroupEditorPage />))

    typeInto(container.querySelector('input[placeholder^="e.g. Roommates"]') as HTMLInputElement, 'Roommates')
    add('Alice')
    typeInto(nameInput(), 'Carol')
    act(() => button('Save group').click())

    expect(getSavedGroups()[0].people.map(p => p.name)).toEqual(['Alice', 'Carol'])
  })
})
