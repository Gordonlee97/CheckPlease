/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'

const openDB = jest.fn()
jest.mock('idb', () => ({
  openDB: (...args: unknown[]) => {
    openDB(...args)
    return jest.requireActual('idb').openDB(...args)
  },
}))

import { saveSession, listSessions, getSession, deleteSession } from '../src/lib/storage'
import type { Session } from '../src/lib/types'

const session: Session = {
  id: 'a', createdAt: '2026-09-15T18:00:00.000Z', label: 'Taco House',
  people: [{ id: 'p1', name: 'Alex' }],
  items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: ['p1'] }],
  subtotal: 12, tax: 1, tip: 2, total: 15,
}

it('opens the database once no matter how many operations run', async () => {
  await saveSession(session)
  await listSessions()
  await getSession('a')
  await deleteSession('a')
  await listSessions()

  expect(openDB).toHaveBeenCalledTimes(1)
})

it('still reads back what it wrote', async () => {
  await saveSession(session)
  expect((await getSession('a'))?.label).toBe('Taco House')
  await deleteSession('a')
  expect(await getSession('a')).toBeUndefined()
})
