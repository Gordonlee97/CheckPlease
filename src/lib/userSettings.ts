import { useSyncExternalStore } from 'react'
import { registerInvalidator, notifyStoreChanged, subscribeToStore } from './localStorageStore'

const KEY = 'checkplease:user-settings'

interface UserSettings {
  venmoHandle?: string
}

const EMPTY: UserSettings = {}

// Cached so the snapshot is referentially stable between writes.
let cache: UserSettings | null = null
registerInvalidator(() => { cache = null })

function getSettings(): UserSettings {
  if (typeof window === 'undefined') return EMPTY
  if (cache === null) {
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch { cache = EMPTY }
  }
  return cache ?? EMPTY
}

function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(settings))
  cache = null
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
