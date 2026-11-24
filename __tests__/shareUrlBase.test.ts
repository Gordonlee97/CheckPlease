/**
 * @jest-environment jsdom
 */
import { buildShareUrl } from '../src/lib/share'
import type { Session } from '../src/lib/types'

const session: Session = {
  id: 's1', createdAt: '2026-11-20T18:00:00.000Z',
  people: [{ id: 'p1', name: 'Alex' }], items: [],
  subtotal: 0, tax: 0, tip: 0, total: 0,
}

const original = process.env.NEXT_PUBLIC_SHARE_BASE_URL
afterEach(() => { process.env.NEXT_PUBLIC_SHARE_BASE_URL = original })

// A base URL configured with a trailing slash produced "...//share#...".
it('joins a base URL that ends in a slash without doubling it', () => {
  process.env.NEXT_PUBLIC_SHARE_BASE_URL = 'https://checkplease.space/'
  expect(buildShareUrl(session)).toMatch(/^https:\/\/checkplease\.space\/share#/)
})

it('still joins a base URL without a trailing slash', () => {
  process.env.NEXT_PUBLIC_SHARE_BASE_URL = 'https://checkplease.space'
  expect(buildShareUrl(session)).toMatch(/^https:\/\/checkplease\.space\/share#/)
})
