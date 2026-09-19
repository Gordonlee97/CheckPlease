/**
 * @jest-environment jsdom
 */
// buildQrDataUrl draws on a canvas, which jsdom doesn't have; the real
// generator is covered in qr.test.ts and by an independent decoder check.
const buildQrImage = jest.fn()
jest.mock('../src/lib/qr', () => ({ buildQrImage: (text: string) => buildQrImage(text) }))

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SummaryView } from '../src/components/steps/SummaryView'
import { computeSplit } from '../src/lib/splitting'
import type { Session } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  buildQrImage.mockReset().mockResolvedValue({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=', size: 222 })
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

describe('SummaryView QR code', () => {
  it('is offered but not shown until asked', () => {
    render('USD')
    expect(container.textContent).toContain('Show QR code')
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders a QR image for the share link on request', async () => {
    render('USD')
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Show QR code')!

    await act(async () => { button.click() })

    const img = container.querySelector('img')
    expect(buildQrImage).toHaveBeenCalledWith(expect.stringContaining('/share#'))
    expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    expect(img?.getAttribute('alt')).toMatch(/QR/i)
    expect(img?.getAttribute('width')).toBe('222') // rendered 1:1, never CSS-scaled
    expect(container.textContent).toContain('Hide QR code')
  })

  it('hides it again on a second tap', async () => {
    render('USD')
    const show = [...container.querySelectorAll('button')].find(b => b.textContent === 'Show QR code')!
    await act(async () => { show.click() })

    const hide = [...container.querySelectorAll('button')].find(b => b.textContent === 'Hide QR code')!
    await act(async () => { hide.click() })

    expect(container.querySelector('img')).toBeNull()
  })

  it('explains itself when the split is too big to encode', async () => {
    buildQrImage.mockResolvedValue(null) // over QR_MAX_CHARS
    render('USD')
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Show QR code')!

    await act(async () => { button.click() })

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toMatch(/too many items/i)
  })
})
