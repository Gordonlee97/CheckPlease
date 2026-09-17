/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { saveSession, listSessions, getSession, deleteSession } from '../src/lib/storage'
import type { Session } from '../src/lib/types'

function session(id: string, createdAt: string, label: string): Session {
  return {
    id, createdAt, label,
    people: [{ id: 'p1', name: 'Alex' }],
    items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: ['p1'] }],
    subtotal: 12, tax: 1, tip: 2, total: 15,
  }
}

beforeEach(async () => {
  for (const s of await listSessions()) await deleteSession(s.id)
})

describe('session storage', () => {
  it('saves and reads back a split', async () => {
    await saveSession(session('a', '2026-09-15T18:00:00.000Z', 'Taco House'))
    expect((await getSession('a'))?.label).toBe('Taco House')
  })

  it('lists splits newest first', async () => {
    await saveSession(session('a', '2026-09-14T18:00:00.000Z', 'Older'))
    await saveSession(session('b', '2026-09-15T18:00:00.000Z', 'Newer'))
    expect((await listSessions()).map(s => s.label)).toEqual(['Newer', 'Older'])
  })

  it('deletes a split without touching the others', async () => {
    await saveSession(session('a', '2026-09-14T18:00:00.000Z', 'Keep'))
    await saveSession(session('b', '2026-09-15T18:00:00.000Z', 'Remove'))

    await deleteSession('b')

    expect(await getSession('b')).toBeUndefined()
    expect((await listSessions()).map(s => s.label)).toEqual(['Keep'])
  })

  it('is a no-op when the split is already gone', async () => {
    await expect(deleteSession('missing')).resolves.toBeUndefined()
  })
})
