import { encodeSession, decodeSession, buildPlainText } from '../src/lib/share'
import type { Session } from '../src/lib/types'
import type { PersonShare } from '../src/lib/splitting'

const session: Session = {
  id: 'abc',
  createdAt: '2026-04-22T20:00:00.000Z',
  label: 'The Burger Place',
  people: [
    { id: 'g', name: 'Gordon' },
    { id: 's', name: 'Sarah' },
  ],
  items: [
    { id: '1', name: 'Burger', price: 14, assignedTo: ['g'] },
    { id: '2', name: 'Nachos', price: 12, assignedTo: ['g', 's'] },
  ],
  subtotal: 26,
  tax: 2.6,
  tip: 5.2,
  total: 33.8,
}

describe('encodeSession / decodeSession', () => {
  it('round-trips a session through encode and decode', () => {
    const encoded = encodeSession(session)
    const decoded = decodeSession(encoded)
    expect(decoded).toEqual(session)
  })

  it('encoded string contains only URL-safe characters', () => {
    const encoded = encodeSession(session)
    expect(encoded).toMatch(/^[A-Za-z0-9\-_.~]*$/)
  })

  it('decodeSession returns null for invalid input', () => {
    expect(decodeSession('not-valid-data!!')).toBeNull()
  })
})

describe('buildPlainText', () => {
  const shares: PersonShare[] = [
    {
      personId: 'g',
      name: 'Gordon',
      itemSubtotal: 20,
      taxShare: 2,
      tipShare: 4,
      total: 26,
      assignedItems: [
        { name: 'Burger', price: 14, shared: false },
        { name: 'Nachos', price: 6, shared: true },
      ],
    },
    {
      personId: 's',
      name: 'Sarah',
      itemSubtotal: 6,
      taxShare: 0.6,
      tipShare: 1.2,
      total: 7.8,
      assignedItems: [{ name: 'Nachos', price: 6, shared: true }],
    },
  ]

  it('includes restaurant name and each person', () => {
    const text = buildPlainText(session, shares)
    expect(text).toContain('The Burger Place')
    expect(text).toContain('Gordon')
    expect(text).toContain('Sarah')
  })

  it('marks shared items', () => {
    const text = buildPlainText(session, shares)
    expect(text).toContain('Nachos (shared)')
  })

  it('includes YOU OWE amount for each person', () => {
    const text = buildPlainText(session, shares)
    expect(text).toContain('$26.00')
    expect(text).toContain('$7.80')
  })
})
