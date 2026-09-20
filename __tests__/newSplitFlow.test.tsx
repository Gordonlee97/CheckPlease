/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

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
  const add = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Add')!
  act(() => add.click())
}

const continueButton = () =>
  [...container.querySelectorAll('button')].find(b => b.textContent?.includes("That's Everyone")) as HTMLButtonElement | undefined

describe('new split: continuing past the people step', () => {
  it('enables the continue button once two people are added', () => {
    act(() => root.render(<NewSplitPage />))

    addPerson('Alex')
    addPerson('Sam')

    expect(container.textContent).toContain('Alex')
    expect(container.textContent).toContain('Sam')
    expect(continueButton()?.disabled).toBe(false)
  })
})
