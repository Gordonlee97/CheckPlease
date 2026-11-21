/**
 * @jest-environment jsdom
 */
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AddPeople } from '../src/components/steps/AddPeople'
import { PERSON_COLORS, nextPersonColor } from '../src/lib/personColors'
import type { Person } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('nextPersonColor', () => {
  it('takes the first colour nobody is using', () => {
    expect(nextPersonColor([])).toBe(PERSON_COLORS[0])
    expect(nextPersonColor([PERSON_COLORS[1], PERSON_COLORS[2]])).toBe(PERSON_COLORS[0])
    expect(nextPersonColor([PERSON_COLORS[0], undefined])).toBe(PERSON_COLORS[1])
  })

  it('reuses colours in order once every one is taken', () => {
    expect(nextPersonColor([...PERSON_COLORS])).toBe(PERSON_COLORS[0])
  })
})

// Colour is how people tell chips and running totals apart on Assign. Picking
// by list length handed a newcomer the colour of someone still listed.
describe('AddPeople colours after someone is removed', () => {
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

  function add(name: string) {
    const input = container.querySelector('input[placeholder="Name"]') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(input, name)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => button('Add').click())
  }

  it('gives the next person a colour no one else has', () => {
    const onDone = jest.fn()
    const ref = createRef<{ submit: () => void }>()
    act(() => root.render(<AddPeople onDone={onDone} ref={ref} />))

    add('A'); add('B'); add('C')
    act(() => (container.querySelector('[aria-label="Remove A"]') as HTMLButtonElement).click())
    add('D')
    act(() => ref.current!.submit())

    const colors = (onDone.mock.calls[0][0] as Person[]).map(p => p.color)
    expect(new Set(colors).size).toBe(colors.length)
  })
})
