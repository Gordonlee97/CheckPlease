import { openDB } from 'idb'
import type { Session } from './types'

const DB_NAME = 'checkplease'
const STORE = 'sessions'
const VERSION = 1

// Opened once and reused. Every call used to open its own connection, none of
// which were ever closed, so they accumulated for as long as the tab lived.
let dbPromise: ReturnType<typeof openDB> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      },
    }).catch(err => {
      dbPromise = null   // let the next call retry rather than caching a failure
      throw err
    })
  }
  return dbPromise
}

export async function saveSession(session: Session): Promise<void> {
  const db = await getDB()
  await db.put(STORE, session)
}

export async function listSessions(): Promise<Session[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get(STORE, id)
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}
