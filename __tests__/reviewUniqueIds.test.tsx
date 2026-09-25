/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Review } from '../src/components/steps/Review'
import type { Item } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

const items: Item[] = [{ id: '1', name: 'Coffee', price: 4, assignedTo: [] }]

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderReviews(count: number) {
  act(() => root.render(
    <>
      {Array.from({ length: count }, (_, n) => (
        <Review key={n} items={items} tax={0} tip={0} onDone={jest.fn()} />
      ))}
    </>
  ))
}

describe('Review: element ids', () => {
  it('every label points at exactly one input', () => {
    renderReviews(1)

    const labels = [...container.querySelectorAll('label[for]')]
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      const target = label.getAttribute('for')!
      expect(container.querySelectorAll(`[id="${target}"]`)).toHaveLength(1)
    }
  })

  it('does not reuse ids when two Reviews share a page', () => {
    renderReviews(2)

    const ids = [...container.querySelectorAll('[id]')].map(el => el.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps each label bound to an input inside its own Review', () => {
    renderReviews(2)

    for (const label of container.querySelectorAll('label[for]')) {
      const target = label.getAttribute('for')!
      const matches = container.querySelectorAll(`[id="${target}"]`)
      expect(matches).toHaveLength(1)
      // the input must live in the same Review as its label
      expect(label.closest('div[class*="grid"], div')!.contains(matches[0])
        || label.parentElement!.parentElement!.contains(matches[0])).toBe(true)
    }
  })
})
