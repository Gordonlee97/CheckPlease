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
export function readCached<T>(key: string, cache: Cached<T>, empty: T): T {
  if (typeof window === 'undefined') return empty
  const raw = localStorage.getItem(key)
  if (raw !== cache.raw) {
    cache.raw = raw
    try {
      cache.value = raw ? JSON.parse(raw) as T : empty
    } catch {
      cache.value = empty
    }
  }
  return cache.value
}
