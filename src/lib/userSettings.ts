import { useSyncExternalStore } from 'react'
import { readCached, notifyStoreChanged, subscribeToStore } from './localStorageStore'

const KEY = 'checkplease:user-settings'

interface UserSettings {
  venmoHandle?: string
}

const EMPTY: UserSettings = {}

// Referentially stable between changes, as useSyncExternalStore requires.
const cache = { raw: null as string | null, value: EMPTY }

function getSettings(): UserSettings {
  return readCached(KEY, cache, EMPTY)
}

function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(settings))
  notifyStoreChanged()
}

export function getMyVenmoHandle(): string | undefined {
  return getSettings().venmoHandle || undefined
}

export function setMyVenmoHandle(handle: string): void {
  const trimmed = handle.replace(/^@/, '').trim()
  saveSettings({ ...getSettings(), venmoHandle: trimmed || undefined })
}

export function useMyVenmoHandle(): string | undefined {
  return useSyncExternalStore(subscribeToStore, getMyVenmoHandle, () => undefined)
}
