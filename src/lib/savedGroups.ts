import { useSyncExternalStore } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { readCached, notifyStoreChanged, subscribeToStore } from './localStorageStore'

const KEY = 'checkplease:saved-groups'

export interface GroupPerson {
  name: string
  color: string
  venmoHandle?: string
}

export interface SavedGroup {
  id: string
  name: string
  people: GroupPerson[]
  updatedAt: string
}

const EMPTY: SavedGroup[] = []

// Referentially stable between changes, as useSyncExternalStore requires.
const cache = { raw: null as string | null, value: EMPTY }

export function getSavedGroups(): SavedGroup[] {
  return readCached(KEY, cache, EMPTY)
}

function write(groups: SavedGroup[]): void {
  localStorage.setItem(KEY, JSON.stringify(groups))
  notifyStoreChanged()
}

export function getSavedGroup(id: string): SavedGroup | null {
  return getSavedGroups().find(g => g.id === id) ?? null
}

export function saveGroup(group: Omit<SavedGroup, 'id' | 'updatedAt'> & { id?: string }): SavedGroup {
  if (typeof window === 'undefined') return { ...group, id: group.id ?? uuidv4(), updatedAt: new Date().toISOString(), people: group.people }
  const groups = getSavedGroups().slice()
  const id = group.id ?? uuidv4()
  const updated: SavedGroup = { ...group, id, updatedAt: new Date().toISOString() }
  const existing = groups.findIndex(g => g.id === id)
  if (existing >= 0) groups[existing] = updated
  else groups.unshift(updated)
  write(groups)
  return updated
}

export function deleteGroup(id: string): void {
  if (typeof window === 'undefined') return
  write(getSavedGroups().filter(g => g.id !== id))
}

export function useSavedGroups(): SavedGroup[] {
  return useSyncExternalStore(subscribeToStore, getSavedGroups, () => EMPTY)
}
