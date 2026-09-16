import { useSyncExternalStore } from 'react'
import { readCached, notifyStoreChanged, subscribeToStore } from './localStorageStore'

const KEY = 'checkplease:saved-names'

export interface SavedName {
  name: string
  usedAt: string // ISO
}

const EMPTY: SavedName[] = []

// Referentially stable between changes, as useSyncExternalStore requires.
const cache = { raw: null as string | null, value: EMPTY }

export function getSavedNames(): SavedName[] {
  return readCached(KEY, cache, EMPTY)
}

function write(names: SavedName[]): void {
  localStorage.setItem(KEY, JSON.stringify(names))
  notifyStoreChanged()
}

export function recordNames(names: string[]): void {
  if (typeof window === 'undefined') return
  let saved = getSavedNames().slice()
  for (const name of names) {
    saved = saved.filter(n => n.name.toLowerCase() !== name.toLowerCase())
    saved.unshift({ name, usedAt: new Date().toISOString() })
  }
  write(saved.slice(0, 50))
}

export function forgetName(name: string): void {
  if (typeof window === 'undefined') return
  write(getSavedNames().filter(n => n.name.toLowerCase() !== name.toLowerCase()))
}

export function useSavedNames(): SavedName[] {
  return useSyncExternalStore(subscribeToStore, getSavedNames, () => EMPTY)
}
