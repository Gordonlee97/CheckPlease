/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SummaryView } from '../src/components/steps/SummaryView'
import { computeSplit } from '../src/lib/splitting'
import type { Session } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function session(currency?: string): Session {
  return {
    id: 's', createdAt: '2026-09-18T18:00:00.000Z', label: 'Cafe', currency,
    people: [{ id: 'p1', name: 'Alex', venmoHandle: 'alex' }],
    items: [{ id: 'i1', name: 'Kaffee', price: 10, assignedTo: ['p1'] }],
    subtotal: 10, tax: 0, tip: 0, total: 10,
  }
}

function render(currency?: string) {
  const s = session(currency)
  act(() => root.render(<SummaryView session={s} shares={computeSplit(s.people, s.items, s.tax, s.tip, s.total)} readOnly />))
}

describe('SummaryView currency', () => {
  it('offers Venmo for a dollar split', () => {
    render('USD')
    expect(container.textContent).toContain('Request on Venmo')
    expect(container.textContent).toContain('$')
  })

  it('offers Venmo for splits made before currency existed', () => {
    render(undefined)
    expect(container.textContent).toContain('Request on Venmo')
  })

  // Venmo is US-only, so the deep link would be misleading in another currency
  it('hides Venmo and shows the right symbol for a euro split', () => {
    render('EUR')
    expect(container.textContent).not.toContain('Request on Venmo')
    expect(container.textContent).toContain('€')
    expect(container.textContent).not.toContain('$')
  })
})
