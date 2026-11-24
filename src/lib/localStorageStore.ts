// Subscription plumbing so components can read localStorage through
// useSyncExternalStore instead of copying it into state inside an effect.
//
// useSyncExternalStore requires getSnapshot() to return a referentially stable
// value while nothing has changed, so each store module caches its parsed value
// keyed on the raw string it came from (see readCached below).

const listeners = new Set<() => void>()

// Call after any write so subscribed components re-read their snapshot.
export function notifyStoreChanged(): void {
  listeners.forEach(listener => listener())
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener)
  // 'storage' fires for writes from other tabs; readCached picks those up
  // because the raw string differs from what it last parsed.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

interface Cached<T> {
  raw: string | null
  value: T
}

// Returns the parsed value for `key`, re-parsing only when the stored string
// has changed. Correct even when something outside these modules writes or
// clears localStorage, since the raw string is checked every read.
//
// Stored data is outside the app's control (an older version, another app on
// the origin, a hand edit), so anything that doesn't parse or fails `isValid`
// reads as `empty`. Blocked storage, where reading itself throws, does too.
export function readCached<T>(key: string, cache: Cached<T>, empty: T, isValid: (value: unknown) => boolean = () => true): T {
  if (typeof window === 'undefined') return empty
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return empty
  }
  if (raw !== cache.raw) {
    cache.raw = raw
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : empty
      cache.value = isValid(parsed) ? parsed as T : empty
    } catch {
      cache.value = empty
    }
  }
  return cache.value
}

// Writes `value` as JSON, or removes the key for null. Storage can be full or
// blocked; losing a saved list or draft is better than a crashed tap, so the
// failure is logged and reported rather than thrown.
export function writeStored(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.warn(`[storage] could not write ${key}:`, err)
    return false
  } finally {
    notifyStoreChanged()
  }
}

export const isArray = (value: unknown): boolean => Array.isArray(value)
export const isPlainObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
