/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AddPeople } from '../src/components/steps/AddPeople'

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

function type(value: string) {
  const input = container.querySelector('input[placeholder="Name"]') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function clickAdd() {
  const add = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Add')!
  act(() => add.click())
}

describe('AddPeople readiness', () => {
  it('reports ready once two people are added', () => {
    const onReadyChange = jest.fn()
    act(() => root.render(<AddPeople onDone={jest.fn()} onReadyChange={onReadyChange} />))

    type('Alex'); clickAdd()
    type('Sam'); clickAdd()

    expect(container.textContent).toContain('Alex')
    expect(container.textContent).toContain('Sam')
    expect(onReadyChange.mock.calls.at(-1)?.[0]).toBe(true)
  })

  it('keeps reporting ready when a third person is added', () => {
    const onReadyChange = jest.fn()
    act(() => root.render(<AddPeople onDone={jest.fn()} onReadyChange={onReadyChange} />))

    type('Alex'); clickAdd()
    type('Sam'); clickAdd()
    type('Kim'); clickAdd()

    expect(onReadyChange.mock.calls.at(-1)?.[0]).toBe(true)
  })
})
