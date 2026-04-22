import { openDB } from 'idb'
import type { Session } from './types'

const DB_NAME = 'checkplease'
const STORE = 'sessions'
const VERSION = 1

async function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'id' })
    },
  })
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
