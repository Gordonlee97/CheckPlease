/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
jest.mock('../src/lib/qr', () => ({ buildQrImage: async () => null }))
import { encodeSession, decodeSession } from '../src/lib/share'
import { computeSplit } from '../src/lib/splitting'
import { SummaryView } from '../src/components/steps/SummaryView'
import type { Session } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const valid: Session = {
  id: 's', createdAt: '2026-09-18T18:00:00.000Z', label: 'Dinner', currency: 'USD',
  people: [{ id: 'p1', name: 'Bob', color: '#c9a84c' }],
  items: [{ id: 'i1', name: 'Pizza', price: 5, assignedTo: ['p1'] }],
  subtotal: 5, tax: 0, tip: 0, total: 5,
}

// Re-encodes an arbitrary payload the way a hand-written share URL would carry it
const asLink = (payload: unknown) => encodeSession(payload as Session)

describe('decodeSession: payloads from a share link', () => {
  it('accepts a genuine split unchanged', () => {
    expect(decodeSession(asLink(valid))).toEqual(valid)
  })

  it('rejects a split whose items are missing assignedTo', () => {
    const { items, ...rest } = valid
    const broken = { ...rest, items: [{ id: 'i1', name: 'Pizza', price: 5 }] }
    expect(decodeSession(asLink(broken))).toBeNull()
    void items
  })

  it('rejects wrong types where numbers are expected', () => {
    expect(decodeSession(asLink({ ...valid, total: '5' }))).toBeNull()
  })

  it('rejects a price that JSON.parse turned into Infinity', () => {
    const overflow = JSON.parse('{"p":1e400}').p
    expect(overflow).toBe(Infinity)
    expect(decodeSession(asLink({ ...valid, items: [{ ...valid.items[0], price: overflow }] }))).toBeNull()
  })

  it('rejects a payload that is valid JSON but not a split', () => {
    expect(decodeSession(asLink({ hello: 'world' }))).toBeNull()
  })

  it('drops unknown keys rather than carrying them into the app', () => {
    const decoded = decodeSession(asLink({ ...valid, injected: 'nope' }))
    expect(decoded).not.toBeNull()
    expect(decoded).not.toHaveProperty('injected')
  })
})

describe('venmo deep link', () => {
  function openedUrlFor(venmoHandle: string) {
    const session: Session = { ...valid, people: [{ id: 'p1', name: 'Bob', venmoHandle }] }
    const opened: string[] = []
    window.open = ((url: string) => { opened.push(url); return null }) as typeof window.open

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => root.render(
      <SummaryView session={session} shares={computeSplit(session.people, session.items, 0, 0, 5)} readOnly />
    ))
    const btn = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Request on Venmo'))!
    act(() => btn.click())
    act(() => root.unmount())
    container.remove()
    return opened[0]
  }

  it('still builds the normal link for an ordinary handle', () => {
    expect(openedUrlFor('bob')).toBe(
      'venmo://paycharge?txn=charge&recipients=bob&amount=5.00&note=Dinner'
    )
  })

  it('does not let a handle add its own amount', () => {
    const url = openedUrlFor('attacker&amount=500.00')
    expect(url).not.toContain('amount=500.00')
    expect(url).toContain('amount=5.00')
  })

  it('does not let a handle change the transaction type', () => {
    const url = openedUrlFor('x&txn=pay&recipients=attacker')
    expect(url).not.toContain('txn=pay')
    expect(url.match(/recipients=/g)).toHaveLength(1)
  })

  it('does not let a handle truncate the link with a fragment', () => {
    expect(openedUrlFor('bob#1')).toContain('note=Dinner')
  })
})
